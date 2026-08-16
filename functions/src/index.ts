import * as admin from 'firebase-admin';

admin.initializeApp();

export * from './distribution'; // Mostly for unit tests
export * from './tasks';
export * from './webhooks';
export * from './leads';
export * from './followUps';
export * from './closedDeals';
