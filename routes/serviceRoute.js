import express from 'express';
import { createCategory, createService, deleteCategory, deleteService, getAllCategories, getCategory, getCategoryStats, getSubCategoryStats, updateCategory, updateService } from '../controllers/serviceController.js';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.js';
import singleUpload from '../middlewares/multer.js';

const router = express.Router();
//admin routes
router.post('/create-category', isAuthenticated, authorizeRoles('admin'), singleUpload, createCategory);
router.put('/update-category/:id', isAuthenticated, authorizeRoles('admin'), singleUpload, updateCategory);
router.delete('/delete-category/:id', isAuthenticated, authorizeRoles('admin'), singleUpload, deleteCategory);
router.post('/create-service', isAuthenticated, authorizeRoles('admin'), createService);
router.put('/update-service/:id', isAuthenticated, authorizeRoles('admin'), updateService);
router.delete('/delete-service/:id', isAuthenticated, authorizeRoles('admin'), deleteService);

//normal route
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategory);
router.get("/category-stats", getCategoryStats);
router.get('/:category/subcategories', getSubCategoryStats);

export default router;