
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.4'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle M-Pesa STK callback
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    // Parse the request body
    const body = await req.json()
    console.log('M-Pesa callback received:', JSON.stringify(body))
    
    // Extract the callback data
    const { Body } = body
    
    if (!Body || !Body.stkCallback) {
      throw new Error('Invalid callback format')
    }
    
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Find transaction by CheckoutRequestID (would need to store this in the transactions table)
    // For now, we'll find the most recent pending transaction that matches
    // In production, you would store the CheckoutRequestID in the transactions table
    
    let mpesaReceiptNumber = null
    let transactionAmount = null
    
    // If transaction was successful, extract the receipt number and amount
    if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
      // Extract receipt number and amount from CallbackMetadata
      for (const item of CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value
        } else if (item.Name === 'Amount') {
          transactionAmount = item.Value
        }
      }
      
      // Update the most recent pending transaction for this checkout request
      // This is a simplified approach - in production, store and match by CheckoutRequestID
      const { data: transactions, error: queryError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (queryError) {
        console.error('Error finding transaction:', queryError)
        throw new Error(`Database error: ${queryError.message}`)
      }
      
      if (transactions && transactions.length > 0) {
        const transaction = transactions[0]
        
        // Update transaction status
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: ResultCode === 0 ? 'completed' : 'failed',
            mpesa_receipt: mpesaReceiptNumber
          })
          .eq('id', transaction.id)
        
        if (updateError) {
          console.error('Error updating transaction:', updateError)
          throw new Error(`Database error: ${updateError.message}`)
        }
        
        console.log(`Transaction ${transaction.id} updated to ${ResultCode === 0 ? 'completed' : 'failed'}`)
      } else {
        console.warn('No pending transaction found to update')
      }
    } else {
      console.log(`Transaction failed with ResultCode ${ResultCode}: ${ResultDesc}`)
      // Handle failed transaction - update status to 'failed'
      // Would need similar logic to find and update the transaction
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Callback processed successfully' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error)
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
