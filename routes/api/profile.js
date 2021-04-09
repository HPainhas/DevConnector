const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');

// Bring in normalize to give us a proper url, regardless of what user entered
const normalize = require('normalize-url');

const Profile = require('../../models/Profile');
const User = require('../../models/User');
const { compareSync } = require('bcryptjs');

// @route   GET api/profile/user
// @desc    Get current user's profile
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({
            user: req.user.id,
        }).populate('user', ['name', 'avatar']);

        if (!profile) {
            return res
                .status(400)
                .json({ msg: 'There is no profile for this user' });
        }

        res.json(profile);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/profile
// @desc    Create or update user's profile
// @access  Private
router.post(
    '/',
    [
        auth,
        [
            body('status', 'Status is required').not().isEmpty(),
            body('skills', 'Skills is required').not().isEmpty(),
        ],
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            website,
            skills,
            youtube,
            twitter,
            instagram,
            linkedin,
            facebook,
            ...rest // Spread the rest of the fields we don't need to check
        } = req.body;

        // Build a profile
        const profileFields = {
            user: req.user.id,
            website:
                website && website !== ''
                    ? normalize(website, { forceHttps: true })
                    : '',
            skills: Array.isArray(skills)
                ? skills
                : skills.split(',').map(skill => ' ' + skill.trim()),
            ...rest,
        };

        // Build socialFields object
        const socialFields = {
            youtube,
            twitter,
            instagram,
            linkedin,
            facebook,
        };

        // Normalize social fields to ensure valid url
        for (const [key, value] of Object.entries(socialFields)) {
            if (value && value.length > 0)
                socialFields[key] = normalize(value, { forceHttps: true });
        }
        // Add to profileFields
        profileFields.social = socialFields;

        try {
            // Using upsert option (creates new doc if no match is found)
            let profile = await Profile.findOneAndUpdate(
                { user: req.user.id },
                { $set: profileFields },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );
            return res.json(profile);
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   GET api/profile/
// @desc    Get all profiles
// @access  Public
router.get('/', async (req, res) => {
    try {
        const profiles = await Profile.find().populate('user', [
            'name',
            'avatar',
        ]);
        res.json(profiles);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/profile/user/:user_id
// @desc    Get profile by user ID
// @access  Public
router.get('/user/:user_id', async (req, res) => {
    try {
        const profile = await Profile.findOne({
            user: req.params.user_id,
        }).populate('user', ['name', 'avatar']);

        if (!profile) return res.status(400).json({ msg: 'Profile not found' });

        res.json(profile);
    } catch (error) {
        console.error(error.message);

        if (error.kind == 'ObjectId') {
            return res.status(400).json({ msg: 'Profile not found' });
        }

        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/profile/
// @desc    Delete profile, user & posts
// @access  Private
router.delete('/', auth, async (req, res) => {
    try {
        // @todo - remove users posts

        // Remove profile
        await Profile.findOneAndRemove({ user: req.user.id });
        // Remove user
        await User.findOneAndRemove({ _id: req.user.id });

        res.json({ msg: 'User has been deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
