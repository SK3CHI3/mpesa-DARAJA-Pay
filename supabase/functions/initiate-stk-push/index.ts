
// Follow the Supabase Edge Function format
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MPESA_CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") || "";
const MPESA_CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") || "";

// M-Pesa API endpoints
const OAUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const LIPA_NA_MPESA_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
const CALLBACK_URL = "https://evghwzipbhnwhwkshumt.functions.supabase.co/stk-callback";

// M-Pesa business short code and passkey (usually provided by Safaricom)
// Using sandbox values for now - replace with your own in production
const BUSINESS_SHORT_CODE = "174379"; // Default sandbox short code
const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // Default sandbox passkey
const TRANSACTION_TYPE = "CustomerPayBillOnline";

// Initialize Supabase client with service role for database operations
const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Function to get M-Pesa access token
async function getMpesaAccessToken() {
  console.log("Getting M-Pesa access token...");
  
  const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
  
  try {
    const response = await fetch(OAUTH_URL, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("M-Pesa auth error:", errorText);
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("M-Pesa auth successful");
    return data.access_token;
  } catch (error) {
    console.error("M-Pesa auth error:", error);
    throw new Error(`Failed to authenticate with M-Pesa: ${error.message}`);
  }
}

// Main function that handles the HTTP request
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      status: 204,
    });
  }
  
  try {
    // Parse the request body
    const requestData = await req.json();
    const { phoneNumber, amount, userId } = requestData;
    
    // Basic validation
    if (!phoneNumber || !amount) {
      return new Response(
        JSON.stringify({ error: "Phone number and amount are required" }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      );
    }
    
    console.log(`Processing payment: ${amount} KES to phone ${phoneNumber}`);
    
    // Format phone number (remove leading 0 and add country code if needed)
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith("0")) {
      formattedPhone = "254" + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith("+")) {
      formattedPhone = phoneNumber.substring(1);
    }
    
    // Get M-Pesa access token
    const accessToken = await getMpesaAccessToken();
    
    // Generate timestamp in the format YYYYMMDDHHmmss
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
    
    // Generate password (base64 of shortcode + passkey + timestamp)
    const password = btoa(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`);
    
    // Prepare STK push request
    const stkRequest = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: TRANSACTION_TYPE,
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: BUSINESS_SHORT_CODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "M-Pesa Simplicity",
      TransactionDesc: "Payment for services",
    };
    
    console.log("Sending STK push request...");
    
    // Make STK push request
    const stkResponse = await fetch(LIPA_NA_MPESA_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkRequest),
    });
    
    // Handle STK response
    if (!stkResponse.ok) {
      const errorText = await stkResponse.text();
      console.error("STK push error:", errorText);
      return new Response(
        JSON.stringify({ error: `M-Pesa request failed: ${stkResponse.status} ${stkResponse.statusText}` }),
        { 
          status: stkResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      );
    }
    
    const stkData = await stkResponse.json();
    console.log("STK push successful:", stkData);
    
    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({ error: `M-Pesa error: ${stkData.ResponseDescription}` }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      );
    }

    // Insert transaction record into database without a user_id if it's null
    let insertData = {
      phone_number: phoneNumber,
      amount: parseFloat(amount),
      status: "pending"
    };
    
    // Only add user_id if it's provided
    if (userId) {
      // @ts-ignore - TypeScript complaining but this is valid
      insertData.user_id = userId;
    }
    
    const { data: transaction, error: insertError } = await supabaseClient
      .from("transactions")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create transaction: ${insertError.message}` }),
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      );
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "STK push sent successfully",
        mpesaRequestId: stkData.CheckoutRequestID,
        transactionId: transaction.id,
      }),
      { 
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );
    
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );
  }
});
