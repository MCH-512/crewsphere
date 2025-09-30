
import { doc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore"; 
import { db } from "./firebase"; // Import the existing db instance

/**
 * Creates a new city document or overwrites an existing one.
 * The document will have a specific ID ("LA").
 */
async function saveOrUpdateCity() {
  try {
    // The 'cities' collection is specified, and the document ID is "LA"
    await setDoc(doc(db, "cities", "LA"), {
      name: "Los Angeles",
      state: "CA",
      country: "USA"
    });
    console.log("Document 'LA' in 'cities' collection has been saved or updated.");
  } catch (e) {
    console.error("Error writing document: ", e);
  }
}

/**
 * Updates only the specified fields of an existing document
 * without overwriting the entire document.
 */
async function updateUserCity() {
  // Assuming you have a "users" collection and a document with a specific user ID
  // Replace 'some-user-id' with an actual user ID
  const userRef = doc(db, "users", "some-user-id"); 
  try {
    await updateDoc(userRef, {
      city: "Los Angeles"
    });
    console.log("User's city has been updated successfully!");
  } catch (e)
   {
    console.error("Error updating user's city: ", e);
  }
}

/**
 * Adds a new document to a collection with a randomly generated ID.
 */
async function addNewCity(cityName: string, state: string, country: string) {
  try {
    const docRef = await addDoc(collection(db, "cities"), {
      name: cityName,
      state: state,
      country: country
    });
    console.log("New city added with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding new city: ", e);
  }
}

// Example of how to call these functions:
// You can uncomment these lines in a relevant part of your app to test.
//
// saveOrUpdateCity();
// updateUserCity();
// addNewCity("New York", "NY", "USA");

