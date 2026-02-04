import { Router } from 'express';
import { TrackingController } from '../../controllers/TrackingController';

const trackingRouter = Router();

trackingRouter.get('/track/open/:jobId', TrackingController.trackOpen);
trackingRouter.get('/track/click/:jobId', TrackingController.trackClick);

export default trackingRouter;
