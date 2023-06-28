import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as vision from "@google-cloud/vision";

// Initialise le client Cloud Vision
const client = new vision.ImageAnnotatorClient();

// Initialise Firebase Admin
admin.initializeApp();

// Firebase Function déclenchée lors de l'upload d'une image
export const processImage = functions.storage.object().onFinalize(
  async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;

    // Vérifiez si l'objet est une image
    if (!filePath || (!filePath.endsWith(".jpg") &&
  !filePath.endsWith(".jpeg") &&
  !filePath.endsWith(".png"))) {
      console.log("Le fichier n'est pas une image ou filePath est null.");
      return null;
    }

    try {
    // Appel de l'API Web Detection
      const [result] = await client.webDetection(`gs://${fileBucket}/${filePath}`);
      const webDetection = result?.webDetection;

      // Vérifiez si des résultats de détection sont disponibles
      if (webDetection) {
      // Traitez les résultats
        if (webDetection.fullMatchingImages &&
            webDetection.fullMatchingImages.length > 0) {
          console.log("*****************************************");
          const entities = webDetection.webEntities;
          if (entities) {
            for (const entity of entities) {
              const description = entity.description?.toLocaleLowerCase();
              if (entity.score && entity.score > 0.5) {
                console.log(`Label : ${description}`);
              }
              if (entity.entityId && entity.entityId.startsWith("/m/")) {
                console.log(`Types : ${description}`);
              } else if (entity.description?.length &&
                entity.description?.length >= 2) {
                console.log(`Brands : ${description}`);
              }
            }
          }


          console.log("Images correspondantes :");
          webDetection.fullMatchingImages.forEach((image) => {
            console.log(` URL : ${image.url}`);
          });
        } else {
          console.log("Aucune image correspondante trouvée.");
        }
      } else {
        console.log("Aucune détection effectuée.");
      }
    } catch (error) {
      console.error("Erreur lors de l'appel de l'API Web Detection:", error);
    }

    return null;
  });
