const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const { body, validationResult } = require('express-validator');

const User = require('../../models/User');

// @route   GET api/auth
// @desc    Authorize user
// @access  Public
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/auth
// @desc    Authenticate user & get token
// @access  Public
router.post(
    '/',
    [
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password is required').exists(),
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            let user = await User.findOne({ email });

            if (!user) {
                return res.status(400).json({
                    errors: [{ msg: 'Invalid credentials' }],
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(400).json({
                    errors: [{ msg: 'Invalid credentials' }],
                });
            }

            const payload = {
                user: {
                    id: user.id,
                },
            };

            // Change expiresIn to 3600 (1 hour) before deploying to production
            jwt.sign(
                payload,
                config.get('jwtSecret'),
                { expiresIn: 360000 },
                (error, token) => {
                    if (error) throw error;
                    res.json({ token });
                }
            );
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Server error');
        }
    }
);

module.exports = router;
