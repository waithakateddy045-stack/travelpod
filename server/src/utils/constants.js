/**
 * Notification type constants
 */
const NOTIFICATION_TYPES = {
    NEW_FOLLOWER: 'new_follower',
    POST_LIKED: 'post_liked',
    POST_COMMENTED: 'post_commented',
    COMMENT_REPLIED: 'comment_replied',
    CONTENT_LIVE: 'content_live',
    CONTENT_REMOVED: 'content_removed',
    NEW_REVIEW: 'new_review',
    NEW_ENQUIRY: 'new_enquiry',
    WELCOME_PROFILE_SETUP: 'welcome_profile_setup',
    COLLABORATION_REQUEST: 'collaboration_request',
    VERIFICATION_APPROVED: 'verification_approved',
    VERIFICATION_REJECTED: 'verification_rejected',
    DISPUTE_DECIDED: 'dispute_decided',
    ENQUIRY_RESPONDED: 'enquiry_responded',
};

/**
 * Account type labels
 */
const ACCOUNT_TYPES = {
    TRAVELER: 'Traveler',
    TRAVEL_AGENCY: 'Travel Agency',
    HOTEL_RESORT: 'Hotel or Resort',
    DESTINATION: 'Destination',
    AIRLINE: 'Airline',
    ASSOCIATION: 'Association',
    ADMIN: 'Admin',
};

/**
 * Moderation severity SLA (hours)
 */
const SLA_HOURS = {
    STANDARD: 4,
    HIGH: 1,
    REVIEW: 24,
};

/**
 * Feed composition rules
 */
const FEED_RULES = {
    MAX_SINGLE_TYPE_PCT: 0.35,
    MIN_TRAVELER_PCT: 0.30,
    MIN_DISCOVERY_PCT: 0.10, // outside user prefs
    FOLLOWED_BOOST_MULTIPLIER: 1.5,
    RECENCY_PENALTY_DAYS: 90,
    RECENCY_PENALTY_FACTOR: 0.40,
    RECENT_ENGAGEMENT_DAYS: 7,
    SKIP_THRESHOLD_SECONDS: 3,
    SKIP_MIN_VIDEO_DURATION: 15,
};

module.exports = {
    NOTIFICATION_TYPES,
    ACCOUNT_TYPES,
    SLA_HOURS,
    FEED_RULES,
};
