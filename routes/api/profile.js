const express = require('express');
const axios = require('axios');
const config = require('config');
const router = express.Router();
const auth = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');

// Bring in normalize to give us a proper url, regardless of what user entered
const normalize = require('normalize-url');

const Profile = require('../../models/Profile');
const User = require('../../models/User');
const { compareSync } = require('bcryptjs');

// @route   GET api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', auth, async (req, res) => {
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
            body('status', 'Status is required').notEmpty(),
            body('skills', 'Skills is required').notEmpty(),
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

        if (!profile) return res.status(404).json({ msg: 'Profile not found' });

        res.json(profile);
    } catch (error) {
        console.error(error.message);

        if (error.kind == 'ObjectId') {
            return res.status(404).json({ msg: 'Profile not found' });
        }

        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/profile/
// @desc    Delete profile, user & posts
// @access  Private
router.delete('/', auth, async (req, res) => {
    try {
        // Remove user posts
        // Remove profile
        // Remove user
        await Promise.all([
            Post.deleteMany({ user: req.user.id }),
            Profile.findOneAndRemove({ user: req.user.id }),
            User.findOneAndRemove({ _id: req.user.id }),
        ]);

        res.json({ msg: 'User has been deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile/experience
// @desc    Add profile experience
// @access  Private
router.put(
    '/experience',
    [
        auth,
        [
            body('title', 'Title is required').notEmpty(),
            body('company', 'Company is required').notEmpty(),
            body('from', 'From date is required and needs to be from the past')
                .notEmpty()
                .custom((value, { req }) =>
                    req.body.to ? value < req.body.to : true
                ),
        ],
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            title,
            company,
            location,
            from,
            to,
            current,
            description,
        } = req.body;

        const newExp = {
            title,
            company,
            location,
            from,
            to,
            current,
            description,
        };

        try {
            const profile = await Profile.findOne({ user: req.user.id });

            profile.experience.unshift(newExp);

            await profile.save();

            res.json(profile);
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   DELETE api/profile/experience/:experience_id
// @desc    Delete experience from profile
// @access  Private
router.delete('/experience/:experience_id', auth, async (req, res) => {
    try {
        const foundProfile = await Profile.findOne({ user: req.user.id });

        foundProfile.experience = foundProfile.experience.filter(
            exp => exp._id.toString() !== req.params.experience_id
        );

        await foundProfile.save();
        return res.status(200).json(foundProfile);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile/education
// @desc    Add profile education
// @access  Private
router.put(
    '/education',
    [
        auth,
        [
            body('school', 'School is required').notEmpty(),
            body('degree', 'Degree is required').notEmpty(),
            body('fieldofstudy', 'Filed of study is required').notEmpty(),
            body('from', 'From date is required and needs to be from the past')
                .notEmpty()
                .custom((value, { req }) =>
                    req.body.to ? value < req.body.to : true
                ),
        ],
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            school,
            degree,
            fieldofstudy,
            from,
            to,
            current,
            description,
        } = req.body;

        const newEdu = {
            school,
            degree,
            fieldofstudy,
            from,
            to,
            current,
            description,
        };

        try {
            const profile = await Profile.findOne({ user: req.user.id });

            profile.education.unshift(newEdu);

            await profile.save();

            res.json(profile);
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   DELETE api/profile/education/:education_id
// @desc    Delete education from profile
// @access  Private
router.delete('/education/:education_id', auth, async (req, res) => {
    try {
        const foundProfile = await Profile.findOne({ user: req.user.id });

        foundProfile.education = foundProfile.education.filter(
            edu => edu._id.toString() !== req.params.education_id
        );

        await foundProfile.save();
        return res.status(200).json(foundProfile);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/profile/github/:username
// @desc    Get user's repositories from GitHub
// @access  Public
router.get('/github/:username', async (req, res) => {
    try {
        const options = {
            uri: encodeURI(
                `https://api.github.com/users/${
                    req.params.username
                }/repos?per_page=5&sort=created:asc&client_id${config.get(
                    'githubClientId'
                )}&client_secret${config.get('githubClientSecret')}`
            ),
            method: 'GET',
            headers: {
                'user-agent': 'node.js',
            },
        };

        const gitHubResponse = await axios.get(options.uri, options);
        return res.json(gitHubResponse.data);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('No GitHub profile found');
    }
});

module.exports = router;
