import fs from 'fs/promises';
import path from 'path';

const screensMetadata: Record<string, any> = {
  "screen-01": {
    "name": "Screen 01",
    "url": "/screen-01",
    "tags": ["with-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-02": {
    "name": "Screen 02",
    "url": "/screen-02",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-03": {
    "name": "Screen 03",
    "url": "/screen-03",
    "tags": ["regression-button-padding"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-04": {
    "name": "Screen 04",
    "url": "/screen-04",
    "tags": ["with-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-05": {
    "name": "Screen 05",
    "url": "/screen-05",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-06": {
    "name": "Screen 06",
    "url": "/screen-06",
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-07": {
    "name": "Screen 07",
    "url": "/screen-07",
    "tags": ["with-banner", "regression-missing-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-08": {
    "name": "Screen 08",
    "url": "/screen-08",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-09": {
    "name": "Screen 09",
    "url": "/screen-09",
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-10": {
    "name": "Screen 10",
    "url": "/screen-10",
    "tags": ["with-banner", "regression-font-size"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-11": {
    "name": "Screen 11",
    "url": "/screen-11",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-12": {
    "name": "Screen 12",
    "url": "/screen-12",
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-13": {
    "name": "Screen 13",
    "url": "/screen-13",
    "tags": ["with-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-14": {
    "name": "Screen 14",
    "url": "/screen-14",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-15": {
    "name": "Screen 15",
    "url": "/screen-15",
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-16": {
    "name": "Screen 16",
    "url": "/screen-16",
    "tags": ["with-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-17": {
    "name": "Screen 17",
    "url": "/screen-17",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  },
  "screen-18": {
    "name": "Screen 18",
    "url": "/screen-18",
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-19": {
    "name": "Screen 19",
    "url": "/screen-19",
    "tags": ["with-banner"],
    "masks": [{ "type": "css", "selector": "[data-testid=\"clock\"]" }]
  },
  "screen-20": {
    "name": "Screen 20",
    "url": "/screen-20",
    "tags": ["with-quote"],
    "masks": [
      { "type": "css", "selector": "[data-testid=\"clock\"]" },
      { "type": "css", "selector": "[data-testid=\"quote\"]" }
    ]
  }
};

async function generateScreenConfigs() {
  console.log('📝 Generating screen.json files...');
  
  const baselinesDir = path.join(process.cwd(), 'baselines');
  
  for (const [screenId, config] of Object.entries(screensMetadata)) {
    const screenDir = path.join(baselinesDir, screenId);
    const screenJsonPath = path.join(screenDir, 'screen.json');
    
    await fs.mkdir(screenDir, { recursive: true });
    
    await fs.writeFile(screenJsonPath, JSON.stringify(config, null, 2));
    console.log(`  ✓ Created ${screenId}/screen.json`);
  }
  
  console.log('✅ All screen.json files generated');
}

generateScreenConfigs().catch((error) => {
  console.error('❌ Error generating screen configs:', error);
  process.exit(1);
});
