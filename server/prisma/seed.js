/**
 * Travelpod Seed Script
 * Creates 1 admin + 40 users + 400 travel video posts with real playable videos
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// ============================================================
// Real playable travel video URLs from free stock services
// ============================================================
const VIDEO_URLS = [
    // Mixkit free travel/nature videos (direct CDN MP4 URLs)
    'https://assets.mixkit.co/videos/1166/1166-720.mp4',    // Aerial tropical beach
    'https://assets.mixkit.co/videos/4367/4367-720.mp4',    // Waves crashing on rocks
    'https://assets.mixkit.co/videos/34563/34563-720.mp4',  // Aerial city view
    'https://assets.mixkit.co/videos/1171/1171-720.mp4',    // Palm trees sunset
    'https://assets.mixkit.co/videos/4883/4883-720.mp4',    // Mountain landscape
    'https://assets.mixkit.co/videos/3784/3784-720.mp4',    // Tropical island drone
    'https://assets.mixkit.co/videos/44632/44632-720.mp4',  // City traffic night 
    'https://assets.mixkit.co/videos/40745/40745-720.mp4',  // Forest aerial
    'https://assets.mixkit.co/videos/2611/2611-720.mp4',    // Sunset clouds
    'https://assets.mixkit.co/videos/13733/13733-720.mp4',  // Waterfall nature
    'https://assets.mixkit.co/videos/1164/1164-720.mp4',    // Ocean waves
    'https://assets.mixkit.co/videos/6090/6090-720.mp4',    // Mountain road
    'https://assets.mixkit.co/videos/4696/4696-720.mp4',    // Snowy mountains
    'https://assets.mixkit.co/videos/3789/3789-720.mp4',    // Beach sunset drone
    'https://assets.mixkit.co/videos/4840/4840-720.mp4',    // City skyline
    'https://assets.mixkit.co/videos/2571/2571-720.mp4',    // Desert landscape
    'https://assets.mixkit.co/videos/4884/4884-720.mp4',    // Green hills
    'https://assets.mixkit.co/videos/2277/2277-720.mp4',    // River flowing
    'https://assets.mixkit.co/videos/4821/4821-720.mp4',    // Northern lights
    'https://assets.mixkit.co/videos/39790/39790-720.mp4',  // Tropical resort
    'https://assets.mixkit.co/videos/39803/39803-720.mp4',  // Pool resort
    'https://assets.mixkit.co/videos/37389/37389-720.mp4',  // Old architecture
    'https://assets.mixkit.co/videos/51461/51461-720.mp4',  // Harbor boats
    'https://assets.mixkit.co/videos/41701/41701-720.mp4',  // Coastal cliffs
    'https://assets.mixkit.co/videos/3791/3791-720.mp4',    // Island paradise
    'https://assets.mixkit.co/videos/4473/4473-720.mp4',    // Jungle waterfall
    'https://assets.mixkit.co/videos/2619/2619-720.mp4',    // Sunrise timelapse
    'https://assets.mixkit.co/videos/4814/4814-720.mp4',    // Snow falling
    'https://assets.mixkit.co/videos/6981/6981-720.mp4',    // Country road
    'https://assets.mixkit.co/videos/1154/1154-720.mp4',    // Coral reef underwater
    'https://assets.mixkit.co/videos/34496/34496-720.mp4',  // Night city lights
    'https://assets.mixkit.co/videos/46068/46068-720.mp4',  // Ancient temple
    'https://assets.mixkit.co/videos/6181/6181-720.mp4',    // Volcano landscape
    'https://assets.mixkit.co/videos/4897/4897-720.mp4',    // Lake reflection
    'https://assets.mixkit.co/videos/3783/3783-720.mp4',    // Drone over ocean
    'https://assets.mixkit.co/videos/39786/39786-720.mp4',  // Safari wildlife
    'https://assets.mixkit.co/videos/4633/4633-720.mp4',    // Cherry blossoms
    'https://assets.mixkit.co/videos/2623/2623-720.mp4',    // Clouds timelapse
    'https://assets.mixkit.co/videos/34567/34567-720.mp4',  // Busy market
    'https://assets.mixkit.co/videos/4844/4844-720.mp4',    // Train journey
];

// Thumbnail generator from video URL
const getThumbnail = (url) => {
    // Use a frame from the video as thumbnail via a placeholder approach
    // In production, Cloudinary generates these automatically
    return url.replace('-720.mp4', '-thumb.jpg').replace('.mp4', '.jpg');
};

// ============================================================
// Seed data arrays
// ============================================================
const ACCOUNT_TYPES = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

const CATEGORIES = [
    { name: 'Beach & Coast', slug: 'beach-coast' },
    { name: 'Mountain & Hiking', slug: 'mountain-hiking' },
    { name: 'City & Urban', slug: 'city-urban' },
    { name: 'Adventure & Extreme', slug: 'adventure-extreme' },
    { name: 'Food & Culture', slug: 'food-culture' },
    { name: 'Luxury & Resorts', slug: 'luxury-resorts' },
    { name: 'Safari & Wildlife', slug: 'safari-wildlife' },
    { name: 'Historical & Heritage', slug: 'historical-heritage' },
    { name: 'Island & Tropical', slug: 'island-tropical' },
    { name: 'Winter & Snow', slug: 'winter-snow' },
    { name: 'Desert & Arid', slug: 'desert-arid' },
    { name: 'Underwater & Marine', slug: 'underwater-marine' },
];

const LOCATIONS = [
    'Bali, Indonesia', 'Santorini, Greece', 'Machu Picchu, Peru', 'Maldives',
    'Paris, France', 'Tokyo, Japan', 'Serengeti, Tanzania', 'Dubai, UAE',
    'Bora Bora, French Polynesia', 'Kyoto, Japan', 'Cape Town, South Africa',
    'Barcelona, Spain', 'Banff, Canada', 'Zanzibar, Tanzania', 'Amalfi Coast, Italy',
    'Queenstown, New Zealand', 'Petra, Jordan', 'Iceland', 'Marrakech, Morocco',
    'Swiss Alps, Switzerland', 'Halong Bay, Vietnam', 'Yosemite, USA',
    'Great Barrier Reef, Australia', 'Sahara Desert, Morocco', 'Tulum, Mexico',
    'Dubrovnik, Croatia', 'Rio de Janeiro, Brazil', 'Patagonia, Argentina',
    'Seychelles', 'Lofoten Islands, Norway', 'Maasai Mara, Kenya',
    'Angkor Wat, Cambodia', 'Phuket, Thailand', 'Lake Como, Italy',
    'Galápagos Islands, Ecuador', 'Turks and Caicos', 'Zanzibar, Tanzania',
    'Cappadocia, Turkey', 'Fiji Islands', 'Iguazu Falls, Brazil',
];

const TAGS_POOL = [
    'travel', 'wanderlust', 'explore', 'adventure', 'nature', 'sunset',
    'beach', 'mountain', 'ocean', 'luxury', 'backpacking', 'roadtrip',
    'foodie', 'culture', 'photography', 'drone', 'safari', 'island',
    'diving', 'hiking', 'camping', 'wildlife', 'cityscape', 'heritage',
    'tropical', 'snow', 'desert', 'waterfalls', 'cruise', 'honeymoon',
    'family', 'solo', 'budgettravel', 'luxury', 'wellness', 'spa',
    'nightlife', 'festival', 'market', 'temple', 'palace', 'volcano',
];

const USER_PROFILES = [
    // Travelers (15)
    { accountType: 'TRAVELER', displayName: 'Alex Wanderer', handle: 'alexwanderer', tags: ['Adventure', 'Solo Travel'] },
    { accountType: 'TRAVELER', displayName: 'Maya Horizons', handle: 'mayahorizons', tags: ['Beach', 'Luxury'] },
    { accountType: 'TRAVELER', displayName: 'Ravi Explorer', handle: 'raviexplorer', tags: ['Culture', 'Food'] },
    { accountType: 'TRAVELER', displayName: 'Sofia Trails', handle: 'sofiatrails', tags: ['Hiking', 'Nature'] },
    { accountType: 'TRAVELER', displayName: 'Jordan Nomad', handle: 'jordannomad', tags: ['Backpacking', 'Budget'] },
    { accountType: 'TRAVELER', displayName: 'Amina Globe', handle: 'aminaglobe', tags: ['Culture', 'Heritage'] },
    { accountType: 'TRAVELER', displayName: 'Luca Voyage', handle: 'lucavoyage', tags: ['Photography', 'Drone'] },
    { accountType: 'TRAVELER', displayName: 'Chloe Coastal', handle: 'chloecoastal', tags: ['Beach', 'Diving'] },
    { accountType: 'TRAVELER', displayName: 'Omar Peaks', handle: 'omarpeaks', tags: ['Mountain', 'Snow'] },
    { accountType: 'TRAVELER', displayName: 'Yuki Passport', handle: 'yukipassport', tags: ['City', 'Food'] },
    { accountType: 'TRAVELER', displayName: 'Nia Sunsets', handle: 'niasunsets', tags: ['Sunset', 'Island'] },
    { accountType: 'TRAVELER', displayName: 'Marco Adventure', handle: 'marcoadventure', tags: ['Extreme', 'Camping'] },
    { accountType: 'TRAVELER', displayName: 'Elena Waves', handle: 'elenawaves', tags: ['Surfing', 'Ocean'] },
    { accountType: 'TRAVELER', displayName: 'Kai Roadtrip', handle: 'kairoadtrip', tags: ['Road Trip', 'Van Life'] },
    { accountType: 'TRAVELER', displayName: 'Zara Wander', handle: 'zarawander', tags: ['Solo', 'Wellness'] },
    // Additional Travelers to reach 55 users (plus 1 admin = 56)
    { accountType: 'TRAVELER', displayName: 'Liam Trek', handle: 'liamtrek', tags: ['Hiking', 'Mountains'] },
    { accountType: 'TRAVELER', displayName: 'Noah Nature', handle: 'noahnature', tags: ['Wildlife', 'Photography'] },
    { accountType: 'TRAVELER', displayName: 'Emma Escape', handle: 'emmaescape', tags: ['Beach', 'Leisure'] },
    { accountType: 'TRAVELER', displayName: 'Olivia Ocean', handle: 'oliviaocean', tags: ['Diving', 'Sailing'] },
    { accountType: 'TRAVELER', displayName: 'Ava Adventure', handle: 'avaadventure', tags: ['Extreme', 'Solo'] },
    { accountType: 'TRAVELER', displayName: 'Isabella Island', handle: 'isabellaisland', tags: ['Tropical', 'Resorts'] },
    { accountType: 'TRAVELER', displayName: 'Sophia City', handle: 'sophiacity', tags: ['Urban', 'Food'] },
    { accountType: 'TRAVELER', displayName: 'Mia Market', handle: 'miamarket', tags: ['Culture', 'Shopping'] },
    { accountType: 'TRAVELER', displayName: 'Charlotte Cruise', handle: 'charlottecruise', tags: ['Luxury', 'Sea'] },
    { accountType: 'TRAVELER', displayName: 'Amelia Air', handle: 'ameliaair', tags: ['Flight Review', 'Travel Tips'] },
    { accountType: 'TRAVELER', displayName: 'Harper Heritage', handle: 'harperheritage', tags: ['History', 'Art'] },
    { accountType: 'TRAVELER', displayName: 'Evelyn Eco', handle: 'evelyneco', tags: ['Sustainable', 'Nature'] },
    { accountType: 'TRAVELER', displayName: 'Abigail Alps', handle: 'abigailalps', tags: ['Skiing', 'Winter'] },
    { accountType: 'TRAVELER', displayName: 'Emily Euro', handle: 'emilyeuro', tags: ['Europe', 'Backpacking'] },
    { accountType: 'TRAVELER', displayName: 'Madison Music', handle: 'madisonmusic', tags: ['Festivals', 'Nightlife'] },
    // Travel Agencies (6)
    { accountType: 'TRAVEL_AGENCY', displayName: 'Horizon Travel Co.', handle: 'horizontravel', tags: ['Packages', 'Guided Tours'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Safari Dreams Agency', handle: 'safaridreams', tags: ['Safari', 'Wildlife'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Blue Ocean Tours', handle: 'blueoceantours', tags: ['Cruise', 'Islands'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Mountain Peak Expeditions', handle: 'mtpeakexp', tags: ['Hiking', 'Trekking'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Luxe Voyages', handle: 'luxevoyages', tags: ['Luxury', 'VIP'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Backpack Adventures', handle: 'backpackadv', tags: ['Budget', 'Youth'] },
    // Hotels & Resorts (6)
    { accountType: 'HOTEL_RESORT', displayName: 'Oceanview Resort & Spa', handle: 'oceanviewresort', tags: ['Beachfront', 'Spa'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Alpine Grand Hotel', handle: 'alpinegrand', tags: ['Ski', 'Mountain'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Tropical Haven Villas', handle: 'tropicalhaven', tags: ['Villa', 'Private'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Urban Boutique Hotel', handle: 'urbanboutique', tags: ['City', 'Design'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Safari Lodge Kenya', handle: 'safarilodgeke', tags: ['Safari', 'Lodge'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Desert Oasis Resort', handle: 'desertoasis', tags: ['Desert', 'Wellness'] },
    // Destinations (5)
    { accountType: 'DESTINATION', displayName: 'Visit Bali Official', handle: 'visitbali', tags: ['Bali', 'Indonesia'] },
    { accountType: 'DESTINATION', displayName: 'Discover Santorini', handle: 'discoversantorini', tags: ['Greece', 'Islands'] },
    { accountType: 'DESTINATION', displayName: 'Explore Kenya', handle: 'explorekenya', tags: ['Kenya', 'Safari'] },
    { accountType: 'DESTINATION', displayName: 'Japan Tourism', handle: 'japantourism', tags: ['Japan', 'Culture'] },
    { accountType: 'DESTINATION', displayName: 'Iceland Adventures', handle: 'icelandadv', tags: ['Iceland', 'Nature'] },
    // Airlines (4)
    { accountType: 'AIRLINE', displayName: 'SkyWing Airlines', handle: 'skywingair', tags: ['Flying', 'Premium'] },
    { accountType: 'AIRLINE', displayName: 'Pacific Air', handle: 'pacificair', tags: ['Pacific', 'Islands'] },
    { accountType: 'AIRLINE', displayName: 'Atlas Airways', handle: 'atlasairways', tags: ['Global', 'Connecting'] },
    { accountType: 'AIRLINE', displayName: 'Horizon Air Express', handle: 'horizonairexp', tags: ['Regional', 'Express'] },
    // Associations (4)
    { accountType: 'ASSOCIATION', displayName: 'World Travel Association', handle: 'worldtravelassoc', tags: ['Industry', 'Standards'] },
    { accountType: 'ASSOCIATION', displayName: 'Sustainable Tourism Fund', handle: 'sustainabletf', tags: ['Eco', 'Sustainable'] },
    { accountType: 'ASSOCIATION', displayName: 'African Tourism Board', handle: 'africantourism', tags: ['Africa', 'Tourism'] },
    { accountType: 'ASSOCIATION', displayName: 'Digital Nomad Network', handle: 'digitalnomadnet', tags: ['Remote', 'Digital'] },
];

const VIDEO_TITLES = [
    // Beach & Coast
    'Hidden Beach Paradise in Bali', 'Sunset at the World\'s Clearest Water', 'Secret Cove Only Locals Know About',
    'Coastline Road Trip — 5 Stops You Can\'t Miss', 'Snorkeling with Sea Turtles in the Maldives',
    'Golden Hour Beach Walk in Santorini', 'The Most Beautiful Cliffs in Portugal', 'Crystal Clear Waters of Turks and Caicos',
    'Surfing Dawn Patrol in Hawaii', 'Bioluminescent Beach Night Swim',
    // Mountain & Hiking
    'Sunrise Trek to Machu Picchu', 'Alps Via Ferrata — Heart-Pounding Views', 'Camping Above the Clouds in Nepal',
    'Wild Mountain Flowers After the Rain', 'The Hardest Day Hike I\'ve Ever Done',
    'Misty Morning in the Swiss Alps', 'Patagonia\'s Torres del Paine Revealed', 'Mount Fuji at Golden Hour',
    'Rocky Mountain Wildlife Encounter', 'Trekking Through Ancient Forests',
    // City & Urban
    'Tokyo After Dark — Neon Wonderland', 'Hidden Rooftop Bars of Barcelona', 'Street Food Tour: Bangkok Edition',
    'Ancient Meets Modern in Istanbul', '24 Hours in Singapore\'s Marina Bay',
    'Paris by Night — The City of Lights', 'Rainy Day in Kyoto\'s Bamboo District', 'Dubai\'s Most Futuristic Architecture',
    'NYC Skyline Sunset Helicopter Ride', 'Lisbon\'s Colorful Tram 28 Journey',
    // Adventure & Extreme
    'Paragliding Over the Swiss Alps', 'Bungee Jumping in Queenstown NZ', 'White Water Rafting the Colorado River',
    'Skydiving Over the Palm Islands', 'Deep Cave Diving in Mexico\'s Cenotes',
    'Ice Climbing Frozen Waterfalls', 'Zip-lining Through Costa Rica Jungle', 'Sandboarding the Sahara Dunes',
    'Volcano Boarding in Nicaragua', 'Kayaking Bioluminescent Bays',
    // Food & Culture
    'Authentic Ramen Journey in Tokyo', 'Wine Tasting in Tuscany\'s Vineyards', 'Street Food Kings of Marrakech',
    'Cooking Class with a Thai Grandmother', 'The World\'s Best Coffee — Ethiopia Origins',
    'Traditional Tea Ceremony in Kyoto', 'Farm-to-Table Experience in Bali', 'Night Market Feast in Taipei',
    'Italian Gelato Making Masterclass', 'Spice Route: India\'s Flavor Trail',
    // Luxury & Resorts
    'Overwater Villa Tour — Maldives', '$50,000 Per Night Suite in Dubai', 'Private Island Life in Fiji',
    'Luxury Safari Lodge Experience', 'First Class Around the World in 30 Days',
    'Infinity Pool with Volcano View', 'Yacht Charter Through Greek Islands', 'Underwater Hotel Room Experience',
    'Private Jet to the Galápagos', 'World\'s Most Exclusive Treehouse Hotel',
    // Safari & Wildlife
    'The Great Migration — Serengeti', 'Baby Elephants Playing in Kenya', 'Leopard Hunt at Sunrise — Masai Mara',
    'Gorilla Trekking in Rwanda', 'Whale Watching Season in South Africa',
    'Wild Horses of Patagonia', 'Polar Bear Encounter in Svalbard', 'Bird Paradise in Costa Rica',
    'Night Safari — Singapore Zoo', 'Swimming with Whale Sharks in Philippines',
    // Historical & Heritage
    'Walking Through Petra\'s Treasury', 'Angkor Wat Sunrise — Ancient Wonder', 'Colosseum at Sunset — Rome',
    'Pyramids of Giza Drone Footage', 'Exploring Machu Picchu\'s Hidden Rooms',
    'Cappadocia Hot Air Balloon Ride', 'The Forbidden City — Beijing Secrets', 'Inca Trail Day 4 — The Sun Gate',
    'Acropolis at Golden Hour — Athens', 'Ancient Temples of Bagan, Myanmar',
    // Island & Tropical
    'Bora Bora from Above — Drone Trip', 'Philippine Island Hopping Guide', 'Madagascar\'s Unique Wildlife',
    'Seychelles — Paradise Found', 'Fiji\'s Blue Lagoon Adventure',
    'Zanzibar Spice Island Tour', 'Hawaiian Jungle Waterfall Chase', 'Mauritius — Island of Colors',
    'Caribbean Sailing Week Highlights', 'Tahiti\'s Black Sand Beach Secrets',
    // Winter & Snow
    'Northern Lights in Tromsø, Norway', 'Skiing the Japanese Powder — Niseko', 'Ice Hotel Night — Swedish Lapland',
    'Dog Sledding in Finnish Lapland', 'Frozen Waterfalls of Iceland',
    'Snowshoeing Through Canadian Rockies', 'Aurora Borealis Timelapse — Iceland', 'Chamonix Off-Piste Adventure',
    'Igloo Stay Under the Stars', 'Winter Wonderland in Hallstatt, Austria',
    // Desert & Arid
    'Sahara Desert Camp Under Stars', 'Wadi Rum by Jeep — Mars on Earth', 'Monument Valley Sunset Drive',
    'White Sands New Mexico at Dawn', 'Atacama Desert Stargazing Experience',
    'Dubai Desert Safari & Dune Bashing', 'Namib Desert — Oldest Desert on Earth', 'Death Valley Extreme Heat Challenge',
    'Uyuni Salt Flats Mirror Effect', 'Joshua Tree Night Photography Guide',
    // Underwater & Marine
    'Great Barrier Reef — Colors Below', 'Manta Ray Night Dive in Hawaii', 'Cenote Diving in Yucatan, Mexico',
    'Mediterranean Shipwreck Exploration', 'Coral Restoration Project — Maldives',
    'Freediving in the Blue Hole Belize', 'Sea Life of the Red Sea — Egypt', 'Jellyfish Lake — Palau Wonder',
    'Kelp Forest Diving — California', 'Underwater Sculpture Park — Grenada',
    // Misc travel
    'My Top 10 Travel Moments This Year', 'Packing Tips for Minimalist Travel', 'Budget Travel Secrets Nobody Shares',
    'Best Travel Photography Tricks', 'How I Travel Full-Time as a Creator',
    'Travel Safety Tips Every Woman Should Know', 'Language Hacks for International Travel', 'Travel Insurance — What You Actually Need',
    'Remote Work from Paradise', 'Slow Travel — Why Rush?',
    'Train Journey Through Vietnam', 'Road Trip Along the Great Ocean Road', 'Campervan Life in New Zealand',
    'Trans-Siberian Railway Adventure', 'Cycling Through the Netherlands',
    'Hot Spring Hopping in Japan', 'Aurora Viewing in Reykjavik', 'River Cruise Down the Mekong',
    'Helicopter Tour — Grand Canyon', 'Balloon Festival in Cappadocia',
    'Wildlife Photography Workshop in Africa', 'Yoga Retreat in Ubud, Bali', 'Volunteering in Costa Rica',
    'Eco Lodge Life in the Amazon', 'Festival of Lights — Thailand',
    'Cherry Blossom Season in Japan', 'Carnival in Rio — Full Experience', 'Diwali Night Market in Delhi',
    'Chinese New Year in Hong Kong', 'Oktoberfest Munich — Complete Guide',
    'Midnight Sun in Norway', 'Monsoon Season in Kerala', 'Autumn Colors in Vermont',
    'Spring in Amsterdam — Tulip Fields', 'Summer Solstice at Stonehenge',
    'Full Moon Party in Thailand', 'Jazz Festival in New Orleans', 'Burning Man — Art in the Desert',
    'Coachella Travel Vlog', 'Songkran Water Festival — Bangkok',
    'Traditional Dance Performance — Bali', 'Flamenco Night in Seville', 'Maori Haka Performance — NZ',
    'Whirling Dervishes in Istanbul', 'Geisha District Walk — Gion, Kyoto',
    'Market Haggling Tips — Marrakech', 'Floating Markets of Bangkok', 'Night Bazaar in Chiang Mai',
    'Souks of Fez — Getting Beautifully Lost', 'Tsukiji Fish Market Dawn Visit',
    'Hobbiton Movie Set Tour — NZ', 'Game of Thrones Locations in Croatia',
    'Star Wars Filming Spots in Tunisia', 'Lord of the Rings Landscapes — NZ',
    'James Bond Island Visit — Thailand',
    // More varied titles
    'Exploring Hidden Waterfalls', 'Local Guide Shows Secret Spots',
    'Traveling on $20 a Day', 'Most Instagrammable Places 2024',
    'Best Sunset I\'ve Ever Seen', 'Travel Fails and What I Learned',
    'Solo Female Travel Diary', 'Couple\'s Paradise Getaway',
    'Family Adventure Week', 'The Perfect Weekend Escape',
    'Off the Beaten Path — Eastern Europe', 'Southeast Asia Backpacking Route',
    'East Africa Safari Circuit', 'South America Grand Tour',
    'Central America Hidden Gems', 'Middle East Cultural Journey',
    'Scandinavian Road Trip', 'Mediterranean Cruise Highlights',
    'Pacific Islands Dream Trip', 'Alaskan Wilderness Adventure',
    'Costa Rica Eco-Tourism Guide', 'Galapagos Wildlife Documentary',
    'Himalayan Trek Journal', 'Australian Outback Explorer',
    'Canadian Rockies by Train', 'Scottish Highlands Journey',
    'Irish Coastal Drive', 'Portuguese Algarve Coast',
    'Croatian Island Hopping', 'Greek Islands Sailing Trip',
    'Norwegian Fjords by Boat', 'Finnish Sauna Culture',
    'Baltic States Road Trip', 'Polish Food Adventure',
    'Czech Republic Castle Tour', 'Austrian Music Trail',
    'Swiss Chocolate Factory Visit', 'Belgium Beer Tasting Journey',
    'Dutch Windmill Countryside', 'French Lavender Fields Provence',
    'Spanish Tapas Marathon', 'Italian Amalfi Drive',
    'Moroccan Imperial Cities', 'Egyptian Nile Cruise',
    'Jordanian Desert Nomads', 'Lebanese Food Paradise',
    'Georgian Wine Country', 'Armenian Monastery Trail',
    'Uzbekistan Silk Road Cities', 'Mongolian Steppe Horseback',
    'Vietnamese Motorbike Loop', 'Cambodian Temple Explorer',
    'Laotian River Journey', 'Myanmar Golden Pagodas',
    'Indonesian Komodo Expedition', 'Philippine Rice Terraces',
    'Malaysian Borneo Rainforest', 'Singaporean Food Hawker Guide',
    'Thai Temple Circuit', 'Nepal Valley of Gods',
    'Sri Lankan Tea Plantations', 'Indian Golden Triangle',
    'Bhutanese Happiness Trail', 'Maldivian Snorkel Safari',
    'Omani Frankincense Route', 'Emirati Desert Glamping',
    'South African Wine Region', 'Kenyan Beach & Bush Combo',
    'Tanzanian Crater Descent', 'Ugandan Primate Tracking',
    'Rwandan Mountain Gorillas', 'Ethiopian Coffee Origins',
    'Namibian Skeleton Coast', 'Botswana Delta by Mokoro',
    'Madagascan Baobab Alley', 'Reunion Island Volcano Hike',
    'Mauritian Underwater Waterfall', 'Mozambican Island Escape',
    'Brazilian Pantanal Wetlands', 'Peruvian Amazon Lodge',
    'Colombian Coffee Triangle', 'Ecuadorian Cloud Forest',
    'Chilean Lake District', 'Argentinian Tango in Buenos Aires',
    'Uruguayan Beach Towns', 'Bolivian Salt Flats Camping',
    'Paraguay River Safari', 'Guyanese Jungle Expedition',
    'Mexican Oaxacan Food Scene', 'Guatemalan Highland Markets',
    'Belizean Barrier Reef Dive', 'Honduran Bay Islands',
    'Nicaraguan Volcano Surfing', 'Costa Rican Cloud Bridges',
    'Panamanian Canal Crossing', 'Cuban Vintage Car Tour',
    'Jamaican Blue Mountain Hike', 'Bahamian Swimming Pigs',
    'Puerto Rican Old San Juan', 'Dominican Republic Whale Watch',
    'Trinidad Carnival Colours', 'Barbadian Rum Distillery',
    'Grenadian Spice Plantation', 'Saint Lucian Piton Climbing',
    'Antiguan Beach Crawl', 'Bermuda Crystal Caves',
    'Icelandic Glacier Walk Extreme', 'Greenlandic Iceberg Cruise',
    'Faroe Islands Sheep Trails', 'Svalbard Polar Expedition',
    'New Zealand Milford Sound', 'Australian Barrier Island',
    'Papua New Guinean Tribal Visit', 'Fijian Kava Ceremony',
    'Tongan Whale Swimming', 'Samoan Village Experience',
    'Tahitian Pearl Farm Tour', 'Easter Island Moai Mystery',
    'Antarctic Peninsula Voyage', 'Arctic Circle Dog Sledding',
    'Trans-Canada Road Trip', 'Route 66 USA Classic Drive',
    'Alaskan Northern Lights Quest', 'Hawaiian Volcano Explorer',
];

const DESCRIPTIONS = [
    'An incredible journey through one of the most beautiful places on Earth. Every moment was breathtaking.',
    'Can you believe this place exists? The colors, the sounds, the atmosphere — pure magic ✨',
    'This hidden gem completely blew my mind. Adding this to the must-visit list!',
    'Traveling here changed my perspective on life. Sometimes you need to get lost to find yourself.',
    'The locals here were the most welcoming people I\'ve ever met. True hospitality!',
    'Golden hour hit different at this spot. Nature really is the best artist 🎨',
    'Budget-friendly paradise that looks like it costs a fortune. Smart travel wins!',
    'Woke up to this view and genuinely questioned if I was dreaming.',
    'The culture, the food, the history — this destination has it all.',
    'Just when I thought I\'d seen it all, this place proved me wrong.',
    'Solo travel moment: sitting in silence, watching the world move slower.',
    'If this doesn\'t make you want to book a flight, nothing will ✈️',
    'Three years of planning, one unforgettable week. Worth every second.',
    'The kind of place that makes you forget about your phone and just live.',
    'Local food, local music, local vibes — the authentic travel experience.',
    'Adventure doesn\'t require a big budget, just a curious mind.',
    'Proof that the journey matters just as much as the destination.',
    'Early morning magic — sometimes the best things happen before sunrise.',
    'This is why I travel. For moments like these that stay with you forever.',
    'Off-season travel hack: same beauty, none of the crowds, half the price.',
    'When the weather is perfect and the view is unreal — travel peak moment!',
    'Found this spot by accident. Best mistakes lead to the best discoveries.',
    'The contrast between ancient and modern here is absolutely fascinating.',
    'Pure adrenaline! This experience was completely out of my comfort zone.',
    'Rainy day adventures are underrated. This place was even MORE beautiful wet.',
    null, null, null, null, null, // Some posts with no description
];

// ============================================================
// Helper functions
// ============================================================
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (daysBack) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
    return date;
};
const randomTags = () => {
    const count = randomInt(2, 5);
    const shuffled = [...TAGS_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};
const generateAvatar = (handle) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`;

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function main() {
    console.log('🌍 Travelpod Seeder — Starting...\n');

    // 1. Clear existing data (order matters for FK constraints)
    console.log('🧹 Clearing existing data...');
    await prisma.adminActionLog.deleteMany();
    await prisma.moderationDecision.deleteMany();
    await prisma.moderationQueue.deleteMany();
    await prisma.disputeDecisionRecord.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.report.deleteMany();
    await prisma.reviewUpvote.deleteMany();
    await prisma.reviewResponse.deleteMany();
    await prisma.broadcastTarget.deleteMany();
    await prisma.broadcastPost.deleteMany();
    await prisma.collaborationParticipant.deleteMany();
    await prisma.collaborationPost.deleteMany();
    await prisma.enquiryResponse.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.directMessage.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.blockedUser.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.badgeMilestone.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.featuredPlacement.deleteMany();
    await prisma.analyticsEvent.deleteMany();
    await prisma.enquiryAnalytics.deleteMany();
    await prisma.save.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.like.deleteMany();
    await prisma.videoReview.deleteMany();
    await prisma.postTag.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.session.deleteMany();
    await prisma.verificationApplication.deleteMany();
    await prisma.post.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();
    await prisma.businessProfile.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    console.log('   ✅ Cleared.\n');

    // 2. Create categories
    console.log('📂 Creating categories...');
    const categories = [];
    for (const cat of CATEGORIES) {
        const created = await prisma.category.create({ data: cat });
        categories.push(created);
    }
    console.log(`   ✅ ${categories.length} categories created.\n`);

    // 3. Create tags
    console.log('🏷️  Creating tags...');
    const tags = [];
    const uniqueTags = [...new Set(TAGS_POOL)];
    for (const tagName of uniqueTags) {
        const created = await prisma.tag.create({ data: { name: tagName } });
        tags.push(created);
    }
    console.log(`   ✅ ${tags.length} tags created.\n`);

    // 4. Create admin user
    console.log('👑 Creating admin user...');
    const adminPassword = await bcrypt.hash('Admin1234', SALT_ROUNDS);
    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@travelpod.com',
            hashedPassword: adminPassword,
            accountType: 'ADMIN',
            onboardingComplete: true,
            emailVerified: true,
        },
    });
    await prisma.profile.create({
        data: {
            userId: adminUser.id,
            displayName: 'Travelpod Admin',
            handle: 'admin',
            avatarUrl: generateAvatar('admin'),
            personalityTags: JSON.stringify(['Platform', 'Management']),
            preferredRegions: JSON.stringify(['Global']),
            contentPreferences: JSON.stringify(['All']),
        },
    });
    console.log(`   ✅ Admin: admin@travelpod.com / Admin1234\n`);

    // 5. Create users with profiles
    console.log('👥 Creating 40 user accounts...');
    const users = [];
    const hashedPw = await bcrypt.hash('Travel1234', SALT_ROUNDS);

    for (const prof of USER_PROFILES) {
        const user = await prisma.user.create({
            data: {
                email: `${prof.handle}@travelpod.test`,
                hashedPassword: hashedPw,
                accountType: prof.accountType,
                onboardingComplete: true,
                emailVerified: true,
            },
        });

        const profile = await prisma.profile.create({
            data: {
                userId: user.id,
                displayName: prof.displayName,
                handle: prof.handle,
                avatarUrl: generateAvatar(prof.handle),
                personalityTags: JSON.stringify(prof.tags),
                preferredRegions: JSON.stringify([randomFrom(LOCATIONS).split(',')[0]]),
                contentPreferences: JSON.stringify(prof.tags),
                followerCount: randomInt(50, 25000),
                followingCount: randomInt(20, 500),
            },
        });

        // Create business profiles for non-traveler accounts
        if (prof.accountType !== 'TRAVELER') {
            const verStatus = Math.random() > 0.4 ? 'APPROVED' : (Math.random() > 0.5 ? 'PENDING' : 'UNVERIFIED');
            await prisma.businessProfile.create({
                data: {
                    profileId: profile.id,
                    country: randomFrom(LOCATIONS).split(', ')[1] || 'International',
                    description: `${prof.displayName} — your trusted partner for unforgettable travel experiences. Specializing in ${prof.tags.join(' & ').toLowerCase()}.`,
                    websiteUrl: `https://${prof.handle}.com`,
                    verificationStatus: verStatus,
                    verifiedAt: verStatus === 'APPROVED' ? randomDate(180) : null,
                    starRating: verStatus === 'APPROVED' ? (3.5 + Math.random() * 1.5).toFixed(1) : null,
                    broadcastSubscription: prof.accountType === 'ASSOCIATION',
                },
            });
        }

        users.push({ ...user, handle: prof.handle, displayName: prof.displayName, accountType: prof.accountType });
    }
    console.log(`   ✅ ${users.length} users created.\n`);

    // 6. Create 400 posts with real videos
    console.log('🎬 Creating 400 travel video posts...');
    const posts = [];
    for (let i = 0; i < 400; i++) {
        const user = randomFrom(users);
        const videoUrl = VIDEO_URLS[i % VIDEO_URLS.length];
        const title = VIDEO_TITLES[i % VIDEO_TITLES.length];
        const category = randomFrom(categories);
        const description = randomFrom(DESCRIPTIONS);

        const post = await prisma.post.create({
            data: {
                userId: user.id,
                videoUrl: videoUrl,
                thumbnailUrl: getThumbnail(videoUrl),
                title: title,
                description: description,
                duration: randomInt(15, 180),
                categoryId: category.id,
                locationTag: randomFrom(LOCATIONS),
                postType: 'STANDARD',
                moderationStatus: i < 380 ? 'APPROVED' : 'PENDING', // 20 left pending for moderation queue
                viewCount: randomInt(100, 500000),
                likeCount: randomInt(10, 50000),
                commentCount: randomInt(0, 2000),
                saveCount: randomInt(0, 5000),
                createdAt: randomDate(90),
            },
        });

        // Attach 2–4 random tags
        const postTags = randomTags().slice(0, randomInt(2, 4));
        for (const tagName of postTags) {
            const tag = tags.find(t => t.name === tagName);
            if (tag) {
                await prisma.postTag.create({
                    data: { postId: post.id, tagId: tag.id },
                }).catch(() => { }); // Skip duplicate tag combos
            }
        }

        posts.push(post);
        if ((i + 1) % 50 === 0) console.log(`   📹 ${i + 1}/400 posts created...`);
    }
    console.log(`   ✅ ${posts.length} posts created (380 approved, 20 pending).\n`);

    // 7. Create follows (each user follows 5–15 others)
    console.log('🤝 Creating follow relationships...');
    let followCount = 0;
    for (const user of users) {
        const toFollow = [...users].sort(() => 0.5 - Math.random()).slice(0, randomInt(5, 15));
        for (const target of toFollow) {
            if (target.id === user.id) continue;
            await prisma.follow.create({
                data: { followerId: user.id, followingId: target.id },
            }).catch(() => { }); // Skip duplicates
            followCount++;
        }
    }
    console.log(`   ✅ ~${followCount} follow relationships created.\n`);

    // 8. Create likes (each user likes 10–30 random posts)
    console.log('❤️  Creating likes...');
    let likeCount = 0;
    for (const user of users) {
        const toLike = [...posts].sort(() => 0.5 - Math.random()).slice(0, randomInt(10, 30));
        for (const post of toLike) {
            await prisma.like.create({
                data: { userId: user.id, postId: post.id },
            }).catch(() => { }); // Skip duplicates
            likeCount++;
        }
    }
    console.log(`   ✅ ~${likeCount} likes created.\n`);

    // 9. Create comments
    console.log('💬 Creating comments...');
    const commentTexts = [
        'This is absolutely stunning! Where exactly is this?',
        'Adding this to my bucket list right now! 🗺️',
        'I was here last year — the vibe is even better in person!',
        'The video quality is insane! What camera do you use?',
        'I need to visit this place before I die 😍',
        'How much did this trip cost? Looks amazing!',
        'This reminds me of my trip to Southeast Asia!',
        'The colors are unreal — is this unedited?',
        'Living vicariously through your travels! Keep posting!',
        'Top 3 places on my travel list now. Thanks for sharing!',
        'My jaw literally dropped watching this. Pure beauty!',
        'How long did you stay? Looks like paradise 🌴',
        'Best travel content on this app! Keep it up! 🔥',
        'Saved this for my next trip planning session!',
        'The music choice is perfect for this footage!',
    ];
    let commentCount = 0;
    for (let i = 0; i < 300; i++) {
        const user = randomFrom(users);
        const post = randomFrom(posts);
        await prisma.comment.create({
            data: {
                postId: post.id,
                userId: user.id,
                content: randomFrom(commentTexts),
                createdAt: randomDate(60),
            },
        }).catch(() => { });
        commentCount++;
    }
    console.log(`   ✅ ${commentCount} comments created.\n`);

    // 10. Create saves
    console.log('🔖 Creating saves...');
    let saveCount = 0;
    for (const user of users.slice(0, 20)) {
        const toSave = [...posts].sort(() => 0.5 - Math.random()).slice(0, randomInt(5, 15));
        for (const post of toSave) {
            await prisma.save.create({
                data: { userId: user.id, postId: post.id },
            }).catch(() => { });
            saveCount++;
        }
    }
    console.log(`   ✅ ~${saveCount} saves created.\n`);

    // 11. Create some verification applications for admin to review
    console.log('📋 Creating verification applications...');
    const businessUsers = users.filter(u => u.accountType !== 'TRAVELER');
    let verAppCount = 0;
    for (const bu of businessUsers.slice(0, 8)) {
        const profile = await prisma.profile.findUnique({ where: { userId: bu.id }, include: { businessProfile: true } });
        if (profile?.businessProfile && profile.businessProfile.verificationStatus !== 'APPROVED') {
            await prisma.verificationApplication.create({
                data: {
                    businessProfileId: profile.businessProfile.id,
                    registrationDocUrl: `https://docs.example.com/registration/${bu.handle}.pdf`,
                    licenceDocUrl: `https://docs.example.com/licence/${bu.handle}.pdf`,
                    operatingAddress: `${randomFrom(LOCATIONS)} — Main Office`,
                    status: 'PENDING',
                },
            });
            // Set business to PENDING verification
            await prisma.businessProfile.update({
                where: { id: profile.businessProfile.id },
                data: { verificationStatus: 'PENDING' },
            });
            verAppCount++;
        }
    }
    console.log(`   ✅ ${verAppCount} verification applications created.\n`);

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('🎉 SEED COMPLETE!');
    console.log('═══════════════════════════════════════════');
    console.log(`   👑 Admin: admin@travelpod.com / Admin1234`);
    console.log(`   👥 Users: ${users.length} (password: Travel1234)`);
    console.log(`   🎬 Posts: ${posts.length} (380 approved, 20 pending)`);
    console.log(`   📂 Categories: ${categories.length}`);
    console.log(`   🏷️  Tags: ${tags.length}`);
    console.log(`   🤝 Follows: ~${followCount}`);
    console.log(`   ❤️  Likes: ~${likeCount}`);
    console.log(`   💬 Comments: ${commentCount}`);
    console.log(`   🔖 Saves: ~${saveCount}`);
    console.log(`   📋 Verification Apps: ${verAppCount}`);
    console.log('═══════════════════════════════════════════\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
