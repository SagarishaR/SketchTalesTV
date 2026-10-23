'use strict';

/**
 * Saves one small record per generated story to DynamoDB.
 * Stores NO drawings, NO names, NO personal data: only story metadata.
 * Best-effort: any failure is logged and ignored, the app keeps working.
 *
 * Env vars: DDB_TABLE (default "sessions"), DDB_REGION (default us-east-1),
 *           USE_DYNAMODB=off to disable.
 */

const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient, PutCommand} = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.DDB_TABLE || 'sessions';
const REGION = process.env.DDB_REGION || 'us-east-1';
const TTL_SECONDS = 24 * 60 * 60;

let docClient = null;

function getClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({region: REGION}), {
      marshallOptions: {removeUndefinedValues: true},
    });
  }
  return docClient;
}

async function saveStoryRecord(story, extra = {}, client) {
  if (!client && process.env.USE_DYNAMODB === 'off') return false;

  try {
    const now = Date.now();
    const item = {
      sessionId: story.id, // partition key of the "sessions" table
      createdAt: new Date(now).toISOString(),
      ttl: Math.floor(now / 1000) + TTL_SECONDS, // matches the table's TTL attribute
      genre: story.genre,
      world: story.recipe && story.recipe.setting,
      quest: story.recipe && story.recipe.quest,
      obstacle: story.recipe && story.recipe.obstacle,
      ending: story.recipe && story.recipe.ending,
      recipeHash: story.recipe && story.recipe.hash,
      sceneCount: Array.isArray(story.scenes) ? story.scenes.length : 0,
      backgroundIds: Array.isArray(story.scenes) ? story.scenes.map(s => s.backgroundId || null) : [],
      narrationSource: extra.narrationSource || 'local',
      model: extra.model || null,
      bedrockMs: extra.bedrockMs ?? null,
    };

    await (client || getClient()).send(new PutCommand({TableName: TABLE, Item: item}));
    console.log(`[dynamodb] saved story record ${story.id} to ${TABLE}`);
    return true;
  } catch (error) {
    console.warn(`[dynamodb] save skipped: ${error.message}`);
    return false;
  }
}

module.exports = {saveStoryRecord};