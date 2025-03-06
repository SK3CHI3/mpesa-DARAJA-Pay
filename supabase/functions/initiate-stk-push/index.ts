
// Import required modules
import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { corsHeaders } from "./utils.ts";
import { sendSTKPush } from "./stkService.ts";

// Supabase Function to handle requests
serve(async (req: Request) => {
  console.log("Received request:", req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request for CORS");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.error("Method not allowed:", req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Parse request body
    const body = await req.json();
    console.log("Request body:", body);
    
    const { phone, amount } = body;
    
    // Validate request body
    if (!phone || !amount) {
      console.error("Invalid request: Missing phone or amount");
      return new Response(
        JSON.stringify({ error: 'Phone number and amount are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`Processing payment request: Phone=${phone}, Amount=${amount}`);
    
    // Send STK Push
    const stkResponse = await sendSTKPush(phone, amount);
    
    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully',
        data: stkResponse
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
