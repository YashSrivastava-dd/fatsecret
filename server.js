import express from "express";
import dotenv from "dotenv";
import { FatSecret } from "./fatsecret.js";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize FatSecret client
const clientId = process.env.FATSECRET_CLIENT_ID;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
const fatsecret = new FatSecret({ clientId, clientSecret });

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// POST /auth/token → obtain OAuth2 access token (metadata by default)
app.post("/auth/token", async (req, res, next) => {
  try {
    const token = await fatsecret.getAccessToken();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = fatsecret.expiresAtEpoch || 0;
    const remaining = Math.max(0, expiresAt - now);

    const includeRaw = req.body?.raw === true || req.body?.raw === "1" || req.body?.raw === "true";
    res.json({
      success: true,
      token_type: "Bearer",
      expires_at_epoch: expiresAt,
      seconds_until_expiry: remaining,
      access_token: includeRaw ? token : undefined,
      access_token_preview: includeRaw ? undefined : `${token?.slice(0, 12) || ""}...(${(token || "").length} chars)`
    });
  } catch (err) {
    next(err);
  }
});

// Debug endpoint to verify env is loaded by the server process
app.get("/debug/env", (req, res) => {
  res.json({
    idLen: (process.env.FATSECRET_CLIENT_ID || "").length,
    secretLen: (process.env.FATSECRET_CLIENT_SECRET || "").length
  });
});

// GET /foods?search=apple&limit=10&page=0 → FatSecret foods.search
app.get("/foods", async (req, res, next) => {
  try {
    const query = (req.query.search || "").toString().trim();
    if (!query) {
      return res.status(400).json({ error: "Missing required query parameter: search" });
    }
    const limit = Number.isNaN(Number(req.query.limit)) ? 10 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);

    const data = await fatsecret.searchFoods({ query, maxResults: limit, page });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /food/:id → FatSecret food.get
app.get("/food/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Missing required path parameter: id" });
    }
    const data = await fatsecret.getFoodById(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /foods/indian-serving?food=chole rice OR ?food_id=5564194 → Get servings according to Indian standards
app.get("/foods/indian-serving", async (req, res, next) => {
  try {
    const foodName = (req.query.food || "").toString().trim();
    const foodId = (req.query.food_id || "").toString().trim();
    
    if (!foodName && !foodId) {
      return res.status(400).json({ error: "Missing required query parameter: food or food_id" });
    }

    let foodDetails;
    let foodInfo;
    let finalFoodId;
    let finalFoodName;

    if (foodId) {
      // Direct lookup by food ID
      finalFoodId = foodId;
      foodDetails = await fatsecret.getFoodById(foodId);
      
      if (!foodDetails?.food) {
        return res.status(404).json({ 
          success: false, 
          error: `No food found with ID "${foodId}"` 
        });
      }
      
      foodInfo = foodDetails.food;
      finalFoodName = foodInfo.food_name || "";
    } else {
      // Search for the food by name
      const searchResults = await fatsecret.searchFoods({ query: foodName, maxResults: 5, page: 0 });
      
      if (!searchResults?.foods?.food || searchResults.foods.food.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: `No food found matching "${foodName}"` 
        });
      }

      // Get the first result (most relevant)
      foodInfo = Array.isArray(searchResults.foods.food) 
        ? searchResults.foods.food[0] 
        : searchResults.foods.food;
      
      finalFoodId = foodInfo.food_id;
      foodDetails = await fatsecret.getFoodById(finalFoodId);
      finalFoodName = foodInfo.food_name || foodName;
    }

    // Extract serving information and convert to Indian standards
    const { indianServings, indianEquivalents, transformedOriginalData } = convertToIndianStandards(foodDetails, foodInfo);
    
    res.json({
      success: true,
      food: {
        id: finalFoodId,
        name: finalFoodName,
        description: foodInfo.food_description || ""
      },
      original_data: transformedOriginalData
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to convert servings to Indian standards
function convertToIndianStandards(foodDetails, foodInfo) {
  const servings = [];
  const seenServings = new Set(); // Track seen servings to avoid duplicates
  
  // Indian standard measurements
  const INDIAN_STANDARDS = {
    // Rice dishes (chole rice, rajma rice, biryani, etc.)
    rice_dish: {
      katori: { grams: 180, description: "1 Katori (medium bowl)" },
      half_katori: { grams: 90, description: "1/2 Katori" },
      full_plate: { grams: 250, description: "1 Full Plate" }
    },
    // Dal/Curry dishes
    dal_curry: {
      katori: { grams: 150, description: "1 Katori (medium bowl)" },
      half_katori: { grams: 75, description: "1/2 Katori" }
    },
    // Roti/Chapati
    roti: {
      piece: { grams: 30, description: "1 Roti/Chapati" },
      two_pieces: { grams: 60, description: "2 Rotis/Chapatis" }
    },
    // Standard Indian cup (200ml)
    cup: {
      one_cup: { grams: 200, description: "1 Cup (Indian standard)" },
      half_cup: { grams: 100, description: "1/2 Cup" }
    }
  };

  // Extract serving information from foodDetails
  const food = foodDetails?.food;
  if (!food) {
    return { indianServings: servings, indianEquivalents: [], transformedOriginalData: foodDetails };
  }

  // Get servings from the food details
  const foodServings = food.servings?.serving || [];
  const servingsArray = Array.isArray(foodServings) ? foodServings : [foodServings];

  // Determine food type based on name
  const foodName = (food.food_name || foodInfo?.food_name || "").toLowerCase();
  const isRiceDish = foodName.includes("rice") || foodName.includes("biryani") || 
                     foodName.includes("pulao") || foodName.includes("khichdi") ||
                     foodName.includes("poha");
  const isDalCurry = foodName.includes("dal") || foodName.includes("curry") || 
                     foodName.includes("sabzi") || foodName.includes("rajma") || 
                     foodName.includes("chole");
  const isRoti = foodName.includes("roti") || foodName.includes("chapati") || 
                 foodName.includes("naan") || foodName.includes("paratha");

  // Determine which Indian standards to use
  let selectedStandards = INDIAN_STANDARDS.cup;
  if (isRiceDish) {
    selectedStandards = INDIAN_STANDARDS.rice_dish;
  } else if (isDalCurry) {
    selectedStandards = INDIAN_STANDARDS.dal_curry;
  } else if (isRoti) {
    selectedStandards = INDIAN_STANDARDS.roti;
  }

  // First, collect all original servings
  let baseServingForEquivalents = null;
  
  servingsArray.forEach(serving => {
    if (!serving) return;
    
    const servingGrams = parseFloat(serving.metric_serving_amount || serving.number || 0);
    const servingUnit = serving.metric_serving_unit || serving.measurement_description || "g";
    
    // Convert to grams if needed
    let grams = servingGrams;
    if (servingUnit.toLowerCase() === "ml" || servingUnit.toLowerCase() === "cup") {
      // Approximate: 1ml ≈ 1g for most foods, 1 cup ≈ 200g
      grams = servingUnit.toLowerCase() === "cup" ? servingGrams * 200 : servingGrams;
    }

    // Skip if grams is 0 or invalid
    if (!grams || grams <= 0) return;

    // Create a unique key to identify duplicate servings
    const servingKey = `${servingGrams}_${servingUnit}`;
    if (seenServings.has(servingKey)) {
      return; // Skip duplicate
    }
    seenServings.add(servingKey);

    // Store the first valid serving as base for Indian equivalents calculation
    if (!baseServingForEquivalents) {
      baseServingForEquivalents = { serving, grams, servingGrams, servingUnit };
    }

    // Add original serving (without indian_equivalents for now)
    servings.push({
      original: {
        amount: servingGrams,
        unit: servingUnit,
        description: serving.measurement_description || servingUnit,
        calories: parseFloat(serving.calories || 0),
        protein: parseFloat(serving.protein || 0),
        carbs: parseFloat(serving.carbohydrate || 0),
        fat: parseFloat(serving.fat || 0),
        fiber: parseFloat(serving.fiber || 0)
      }
    });
  });

  // Calculate Indian equivalents once using the first valid serving
  const indianEquivalents = [];
  if (baseServingForEquivalents) {
    const { serving, grams, servingGrams, servingUnit } = baseServingForEquivalents;
    
    Object.entries(selectedStandards).forEach(([key, value]) => {
      const multiplier = value.grams / grams;
      indianEquivalents.push({
        measurement: key,
        description: value.description,
        equivalent_to: `${(multiplier * servingGrams).toFixed(1)} ${servingUnit}`,
        nutrition: {
          calories: (parseFloat(serving.calories || 0) * multiplier).toFixed(1),
          protein: (parseFloat(serving.protein || 0) * multiplier).toFixed(1),
          carbs: (parseFloat(serving.carbohydrate || 0) * multiplier).toFixed(1),
          fat: (parseFloat(serving.fat || 0) * multiplier).toFixed(1),
          fiber: (parseFloat(serving.fiber || 0) * multiplier).toFixed(1)
        }
      });
    });
  }

  // Transform original_data to show Indian serving sizes
  const transformedOriginalData = { ...foodDetails };
  if (transformedOriginalData.food && transformedOriginalData.food.servings) {
    const indianServingsList = [];
    
    // Use the first non-duplicate serving as base for calculations
    const baseServing = servingsArray.find(s => {
      if (!s) return false;
      const grams = parseFloat(s.metric_serving_amount || 0);
      const unit = s.metric_serving_unit || "g";
      return grams > 0;
    });

    if (baseServing) {
      const baseGrams = parseFloat(baseServing.metric_serving_amount || 0);

      // Create Indian standard servings
      Object.entries(selectedStandards).forEach(([key, value]) => {
        const multiplier = value.grams / baseGrams;
        
        // Create a new serving object with all original fields, scaled appropriately
        const indianServing = {};
        
        // Copy all fields from baseServing
        Object.keys(baseServing).forEach(field => {
          const fieldValue = baseServing[field];
          
          // Fields that should be multiplied (numeric nutritional values)
          const numericFields = [
            'calories', 'protein', 'carbohydrate', 'fat', 'fiber',
            'calcium', 'cholesterol', 'iron', 'potassium', 'sodium',
            'sugar', 'vitamin_a', 'vitamin_c', 'saturated_fat',
            'monounsaturated_fat', 'polyunsaturated_fat'
          ];
          
          if (numericFields.includes(field.toLowerCase()) && fieldValue != null) {
            const numValue = parseFloat(fieldValue);
            if (!isNaN(numValue)) {
              indianServing[field] = (numValue * multiplier).toFixed(2);
            } else {
              indianServing[field] = fieldValue;
            }
          } else if (field === 'metric_serving_amount') {
            indianServing[field] = value.grams.toFixed(3);
          } else if (field === 'metric_serving_unit') {
            indianServing[field] = 'g';
          } else if (field === 'measurement_description' || field === 'serving_description') {
            indianServing[field] = value.description;
          } else if (field === 'number_of_units') {
            indianServing[field] = '1.000';
          } else {
            // Copy other fields as-is (like serving_id, serving_url, etc.)
            indianServing[field] = fieldValue;
          }
        });
        
        indianServingsList.push(indianServing);
      });
    }

    transformedOriginalData.food.servings = {
      serving: indianServingsList
    };
  }

  return { indianServings: servings, indianEquivalents, transformedOriginalData };
}

// ========== RECIPE ENDPOINTS ==========

// GET /recipes/search?search=pasta&limit=10&page=0&recipe_types=breakfast → FatSecret recipes.search
app.get("/recipes/search", async (req, res, next) => {
  try {
    const query = (req.query.search || "").toString().trim();
    if (!query) {
      return res.status(400).json({ error: "Missing required query parameter: search" });
    }
    const limit = Number.isNaN(Number(req.query.limit)) ? 10 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);
    const recipeTypes = (req.query.recipe_types || "").toString().trim();

    const data = await fatsecret.searchRecipes({ query, maxResults: limit, page, recipeTypes });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recipes/trending?limit=20&page=0&category=dinner → Get popular recipes
// Note: FatSecret doesn't have a dedicated trending endpoint, so this uses recipes.search
app.get("/recipes/trending", async (req, res, next) => {
  try {
    const limit = Number.isNaN(Number(req.query.limit)) ? 20 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);
    const category = (req.query.category || "").toString().trim();

    const data = await fatsecret.getTrendingRecipes({ maxResults: limit, page, category });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recipe/:id → FatSecret recipe.get
app.get("/recipe/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Missing required path parameter: id" });
    }
    const data = await fatsecret.getRecipeById(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Global error handler
// Ensures consistent JSON errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err?.status || 500;
  const payload = {
    success: false,
    error: err?.message || "Internal Server Error"
  };
  if (err?.data) {
    payload.details = err.data;
  }
  res.status(status).json(payload);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});