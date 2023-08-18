import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as vision from "@google-cloud/vision";

admin.initializeApp();
// Initialise le client Cloud Vision
const client = new vision.ImageAnnotatorClient();

const db = admin.firestore();


// Firebase Function déclenchée lors de l'upload d'une image
export const processImage = functions.storage.object().onFinalize(
  async (object) => {
    try {
      const collectionName = "Analysis";

      const fileBucket = object.bucket;
      const filePath = object.name ? object.name : "undefined";

      interface Score {
        tag: string,
        score: number
      }

      const entry = db.collection(collectionName).doc(filePath);
      entry.set({
        isAnalysed: false,
      });

      const scores: Score[] = [];

      functions.logger.info(`***** MAMAN *****${fileBucket}/${filePath}`);

      // Vérifiez si l'objet est une image
      if (!filePath || (!filePath.endsWith(".jpg") &&
        !filePath.endsWith(".jpeg") &&
        !filePath.endsWith(".png"))) {
        functions.logger.error("filePath est null.");
        return null;
      }

      // Appel de l'API Web Detection
      const [result] = await client.webDetection(`gs://${fileBucket}/${filePath}`);
      const webDetection = result?.webDetection;

      // Vérifiez si des résultats de détection sont disponibles
      if (webDetection) {
        // Traitez les résultats
        if (webDetection.fullMatchingImages &&
          webDetection.fullMatchingImages.length > 0) {
          functions.logger.info(`*** Web detection for ${filePath} ***`);
          const entities = webDetection.webEntities;

          if (entities && entities.length) {
            functions.logger.info(`Web entities found: ${entities.length}`);
            entities.forEach((entity) => {
              if (entity.description && entity.score) {
                functions.logger.info(` Description : ${entity.description}`);
                functions.logger.info(` Score: ${entity.score}`);
                const score = {
                  tag: entity.description,
                  score: entity.score,
                };
                scores.push(score);
              }
            });
          } else {
            functions.logger.info("entities is null or length = 0");
          }
        } else {
          functions.logger.info("fullMatchingImages is null or < 0");
        }
      } else {
        functions.logger.info("Web Detection is null");
      }

      entry.set({
        tags: scores,
        isAnalysed: true,
      });

      return null;
    } catch (error) {
      functions.logger.error("Web Detection Error:", error);
      return null;
    }

    return null;
  });
