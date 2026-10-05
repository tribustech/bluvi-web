import { captureRoute } from './capture';

// Acasă: signed out (landing) and signed in as the QA user (operator of Chita).
captureRoute({
  name: 'acasa',
  path: '/',
  states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }],
});
