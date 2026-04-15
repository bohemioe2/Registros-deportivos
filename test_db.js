const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, orderBy, limit } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "TODO",
  projectId: "hazdeporte-3c8b4",
};

// Instead of guessing credentials, I'll just check what's in Next.js config
