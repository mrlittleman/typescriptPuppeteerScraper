import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { Post } from '../types/post';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MESUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

export async function uploadScreenshot(imageBuffer: Buffer, postId: string): Promise<string> {
  const storageRef = ref(storage, `screenshots/${postId}.png`);
  await uploadBytes(storageRef, imageBuffer);
  return await getDownloadURL(storageRef);
}

export async function savePostToFirestore(post: Post): Promise<void> {
  await addDoc(collection(db, 'posts'), post);
}