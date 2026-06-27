import { firestore } from './backend/firebase-server';
async function test() {
  const configRef = firestore.collection('app_config').doc('main');
  console.log('getting config...', configRef.path);
  const doc = await configRef.get();
  console.log(doc.data());
}
test().catch(console.error);
