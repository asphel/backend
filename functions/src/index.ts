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

      const fullMatchingScores : Score[] = [];
      const partialMatchingScores : Score[] = [];
      const entityScores : Score[] = [];

      // Vérifiez si l'objet est une image jpg ou png
      if (!filePath || (!filePath.endsWith(".jpg") &&
        !filePath.endsWith(".jpeg") &&
        !filePath.endsWith(".png"))) {
        functions.logger.error("filePath est null.");
        return null;
      }

      // Appel de l'API Web Detection
      const [result] = await client.webDetection(`gs://${fileBucket}/${filePath}`);
      const webDetection = result?.webDetection;

      if (webDetection) {
        const fullMatchingImages = webDetection.fullMatchingImages;
        const partialMatchingImages = webDetection.partialMatchingImages;
        const entities = webDetection.webEntities;

        functions.logger.info(`*** Web detection for 
        ${fileBucket}/${filePath} ***`);

        if (fullMatchingImages &&
          fullMatchingImages.length > 0) {
          functions.logger.info(`*** ${fullMatchingImages.length} 
          full matching images detected ***`);
          fullMatchingImages.forEach((matchingImage) => {
            if (matchingImage.url && matchingImage.score) {
              functions.logger.info(` URL : ${matchingImage.url}`);
              functions.logger.info(` Score: ${matchingImage.score}`);
              const score = {
                tag: matchingImage.url,
                score: matchingImage.score,
              };
              fullMatchingScores.push(score);
            }
          });
        } else {
          functions.logger.info("*** 0 full matching image detected ***");
        }

        if (partialMatchingImages && partialMatchingImages.length > 0) {
          functions.logger.info(`*** ${partialMatchingImages} 
          partial matching images detected ***`);
          partialMatchingImages.forEach((matchingImage) => {
            if (matchingImage.url && matchingImage.score) {
              functions.logger.info(` URL : ${matchingImage.url}`);
              functions.logger.info(` Score: ${matchingImage.score}`);
              const score = {
                tag: matchingImage.url,
                score: matchingImage.score,
              };
              partialMatchingScores.push(score);
            }
          });
        } else {
          functions.logger.info("*** 0 partial matching image detected ***");
        }

        if (entities && entities.length) {
          functions.logger.info(`*** ${entities.length} 
          Web entities detected ***`);
          entities.forEach((entity) => {
            if (entity.description && entity.score) {
              functions.logger.info(` Description : ${entity.description}`);
              functions.logger.info(` Score: ${entity.score}`);
              const score = {
                tag: entity.description,
                score: entity.score,
              };
              entityScores.push(score);
            }
          });
        } else {
          functions.logger.info("*** 0 entity detected ***");
        }
      } else {
        functions.logger.info("Web Detection is null");
      }

      entry.set({
        fullMatching: fullMatchingScores,
        partialMatching: partialMatchingScores,
        entities: entityScores,
        isAnalysed: true,
      });

      return null;
    } catch (error) {
      functions.logger.error("Web Detection Error:", error);
      return null;
    }
  });
