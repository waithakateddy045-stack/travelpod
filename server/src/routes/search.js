const express = require('express');
const router = express.Router();
const { search, getCategories, getTopRated } = require('../controllers/searchController');

router.get('/', search);
router.get('/categories', getCategories);
router.get('/top-rated', getTopRated);

module.exports = router;
