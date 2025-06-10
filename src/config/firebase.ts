import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
const serviceAccount = require('../../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${process.env.FIREBASE_ID}.appspot.com`,
});

const db = getFirestore();
const bucket = getStorage().bucket();

export { db, bucket };