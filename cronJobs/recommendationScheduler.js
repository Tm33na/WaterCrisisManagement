// cronJobs/recommendationScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Home = require('../models/Home');
const DailyWaterUsage = require('../models/DailyWaterUsage');
const HourlyWaterUsage = require('../models/HourlyWaterUsage');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const Recommendation = require('../models/Recommendation'); // Our new Recommendation model

// Gemini API Configuration (leave apiKey blank, Canvas will inject)
const GEMINI_API_KEY = "AIzaSyA96SG1CcRPhjriROnFeHpZy7CDhGA3XTU"; // Canvas will inject API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Fetches recent usage, alerts, and sensor data for a given home.
 * @param {mongoose.Types.ObjectId} homeId
 * @returns {object} Context data for prompt generation.
 */
async function getHomeContext(homeId) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const home = await Home.findById(homeId).populate('userId').lean();
    if (!home) return null;

    // Daily usage for last 7 days
    const dailyUsage = await DailyWaterUsage.find({ homeId, date: { $gte: sevenDaysAgo, $lte: now } })
        .sort({ date: -1 })
        .lean();

    // Latest hourly usage (last 24 hours)
    const recentHourlyUsage = await HourlyWaterUsage.find({
        'metadata.homeId': homeId,
        'metadata.sensorType': 'water_flow',
        hour: { $gte: oneDayAgo, $lte: now }
    })
    .sort({ hour: -1 })
    .lean();

    // Active alerts for this home
    const activeAlerts = await Alert.find({ 'metadata.homeId': homeId, status: 'active' }).lean();

    // Latest water level and rain status readings
    const latestReadings = await SensorReading.aggregate([
        {
            $match: {
                'metadata.homeId': homeId,
                'metadata.sensorType': { $in: ['water_level', 'rain_status'] },
                timestamp: { $gte: oneDayAgo }
            }
        },
        { $sort: { timestamp: -1 } },
        { $group: { _id: '$metadata.sensorType', latestReading: { $first: '$$ROOT' } } },
        { $project: { _id: 0, sensorType: '$_id', value: '$latestReading.value', unit: '$latestReading.unit', timestamp: '$latestReading.timestamp' } }
    ]);

    const waterLevel = latestReadings.find(r => r.sensorType === 'water_level');
    const rainStatus = latestReadings.find(r => r.sensorType === 'rain_status');

    return {
        home,
        dailyUsage,
        recentHourlyUsage,
        activeAlerts,
        waterLevel,
        rainStatus
    };
}

/**
 * Constructs a detailed prompt for the Gemini API based on home context.
 * @param {object} context - The context data fetched by getHomeContext.
 * @returns {string} The prompt string.
 */
function constructRecommendationPrompt(context) {
    let prompt = `You are an AI water conservation and smart home assistant named "AquaSense". Your goal is to help users conserve water, reduce waste, and manage their home's water efficiently. Based on the following information for "${context.home.name}", provide personalized, actionable, and encouraging recommendations or alerts.

--- Home Context ---
Home Name: "${context.home.name}"
User: "${context.home.userId.username || 'Unknown User'}" (assume their main goal is water conservation and leak prevention)

Recent Daily Water Usage (last 7 days, in liters, most recent first):
`;
    if (context.dailyUsage && context.dailyUsage.length > 0) {
        context.dailyUsage.forEach(usage => {
            prompt += `- ${usage.date.toISOString().split('T')[0]}: ${usage.totalVolumeUsed.toFixed(2)} ${usage.unit}\n`;
        });
    } else {
        prompt += `- No recent daily usage data available.\n`;
    }

    const latestHourlyVolume = context.recentHourlyUsage[0]?.totalVolumeUsed || 0;
    const latestHourlyUnit = context.recentHourlyUsage[0]?.unit || 'liters';
    prompt += `\nLatest Hourly Water Flow: ${latestHourlyVolume.toFixed(2)} ${latestHourlyUnit} (from the most recent full hour).\n`;

    if (context.waterLevel) {
        prompt += `Current Water Tank Level: ${context.waterLevel.value.toFixed(1)} ${context.waterLevel.unit}\n`;
    } else {
        prompt += `Water Tank Level: Not available.\n`;
    }

    if (context.rainStatus) {
        prompt += `Current Rain Status: ${context.rainStatus.value === 1 ? 'It is currently raining.' : 'It is not currently raining.'}\n`;
    } else {
        prompt += `Rain Status: Not available.\n`;
    }

    prompt += `\nActive Alerts:
`;
    if (context.activeAlerts && context.activeAlerts.length > 0) {
        context.activeAlerts.forEach(alert => {
            prompt += `- Type: ${alert.type}, Severity: ${alert.severity}, Message: "${alert.message}"\n`;
        });
    } else {
        prompt += `- No active alerts.\n`;
    }

    prompt += `\n--- Request for AquaSense ---
Considering the above data, please provide:
1.  **Water Conservation Tip for Today/Next 24 Hours:** A specific, actionable tip relevant to the current context.
2.  **Water Wastage Reduction Advice:** Advice on how to reduce potential wastage, especially if a high usage trend or alert is present.
3.  **Contextual Advice:**
    * If it's raining and the home has water tanks, advise on rainwater harvesting (e.g., "open lids").
    * If the tank level is low, remind about refilling or cautious usage.
    * If there are active alerts, specifically address them or remind the user to check them.

Keep the language friendly, encouraging, and concise. Avoid technical jargon where possible. Start directly with the recommendations without a long introduction. If no specific advice seems needed, provide a general encouragement.
`;
    return prompt;
}

/**
 * Calls the Gemini API to get a recommendation.
 * @param {string} prompt - The prompt to send to the LLM.
 * @returns {Promise<string|null>} The generated text or null on error.
 */
async function getRecommendationFromGemini(prompt) {
    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini API returned unexpected structure or no content:", JSON.stringify(result, null, 2));
            return null;
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

/**
 * Schedules a cron job to generate and save daily water conservation recommendations for each user/home.
 */
const startRecommendationCron = () => {
    // Schedule to run daily at a specific time (e.g., 08:00 AM UTC)
    cron.schedule('2 * * * *', async () => {
        console.log('[RECOMMENDATION CRON] Running daily recommendation generation job...');

        try {
            const homes = await Home.find({}).populate('userId').lean(); // Need userId for username and context

            if (homes.length === 0) {
                console.log('[RECOMMENDATION CRON] No homes found. Skipping recommendation generation.');
                return;
            }

            for (const home of homes) {
                if (!home.userId || !home.userId._id) {
                    console.warn(`[RECOMMENDATION CRON] Skipping home ${home.name} (${home._id}) as userId is not properly populated.`);
                    continue;
                }

                const context = await getHomeContext(home._id);
                if (!context) {
                    console.warn(`[RECOMMENDATION CRON] Could not get context for home ${home.name}. Skipping recommendation.`);
                    continue;
                }

                const prompt = constructRecommendationPrompt(context);
                const recommendationContent = await getRecommendationFromGemini(prompt);

                if (recommendationContent) {
                    await Recommendation.create({
                        userId: home.userId._id,
                        homeId: home._id,
                        type: 'daily_conservation_tip', // Default type, can be refined based on content
                        content: recommendationContent,
                        contextData: {
                            dailyUsageSummary: context.dailyUsage.map(u => ({ date: u.date.toISOString().split('T')[0], vol: u.totalVolumeUsed })),
                            hourlyVolume: context.recentHourlyUsage.length > 0 ? context.recentHourlyUsage[0].totalVolumeUsed : 0,
                            waterLevel: context.waterLevel,
                            rainStatus: context.rainStatus,
                            activeAlertsCount: context.activeAlerts.length,
                        }
                    });
                    console.log(`[RECOMMENDATION CRON] Generated and saved recommendation for Home ${home.name}.`);
                } else {
                    console.warn(`[RECOMMENDATION CRON] Failed to generate recommendation for Home ${home.name}.`);
                }
            }
            console.log('[RECOMMENDATION CRON] Daily recommendation generation job completed.');
        } catch (error) {
            console.error('[RECOMMENDATION CRON] Error in daily recommendation cron job:', error);
        }
    }, {
        timezone: "UTC"
    });

    console.log('Daily recommendation cron job scheduled to run at 08:00 AM UTC.');
};

module.exports = startRecommendationCron;
