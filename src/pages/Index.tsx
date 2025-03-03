
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { CreditCard, PhoneCall, ArrowRight, CheckCircle, History, AlertCircle } from "lucide-react";
import { supabase } from "@/App";

// Define our form schema
const formSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, { message: "Phone number must be at least 10 digits" })
    .max(12, { message: "Phone number must not exceed 12 digits" })
    .regex(/^(07|01|\+?254)[0-9]{8,9}$/, {
      message: "Please enter a valid Kenyan phone number",
    }),
  amount: z
    .string()
    .min(1, { message: "Amount is required" })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
});

const Index = () => {
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      amount: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setPaymentStatus("loading");
      setErrorMessage(null);
      
      // Get current user if logged in (will be null for anonymous users)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      console.log("Initiating payment with user ID:", userId || "anonymous");
      
      // Format phone number (ensure it's in the correct format for M-Pesa)
      let phoneNumber = values.phoneNumber;
      // Remove any non-digit characters
      phoneNumber = phoneNumber.replace(/\D/g, '');
      
      // If it starts with '0', replace with '254'
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '254' + phoneNumber.substring(1);
      }
      
      // If it doesn't start with '254', add it
      if (!phoneNumber.startsWith('254')) {
        phoneNumber = '254' + phoneNumber;
      }
      
      // Call the Supabase Edge Function using the client
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: phoneNumber,
          amount: Number(values.amount)
        }
      });
      
      if (error) {
        console.error("Supabase function error:", error);
        setErrorMessage(error.message || "Failed to process payment");
        throw new Error(error.message || "Failed to process payment");
      }
      
      if (!data || data.error) {
        console.error("Payment API error:", data?.error || "Unknown error");
        setErrorMessage(data?.error || "Failed to process payment");
        throw new Error(data?.error || "Failed to process payment");
      }
      
      console.log("Payment response:", data);
      
      setPaymentStatus("success");
      toast({
        title: "Payment initiated",
        description: `You'll receive an M-Pesa prompt on ${values.phoneNumber} to authorize KES ${values.amount}`,
      });
      
      // Reset form
      form.reset();
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentStatus("error");
      toast({
        title: "Payment failed",
        description: error.message || "Could not process M-Pesa payment request",
        variant: "destructive",
      });
    } finally {
      // Reset payment status after 5 seconds
      setTimeout(() => {
        setPaymentStatus("idle");
        setErrorMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Payment form */}
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg text-center">
            <div className="flex items-center justify-center gap-2">
              <CreditCard className="h-6 w-6" />
              <CardTitle className="text-xl">M-Pesa Payment</CardTitle>
            </div>
            <CardDescription className="text-gray-100">
              Fast and secure mobile payments
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Show error message if any */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="text-center">
                      <FormLabel className="flex items-center justify-center gap-2">
                        <PhoneCall className="h-4 w-4" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 0712345678"
                          {...field}
                          className="bg-gray-50 text-center"
                          autoComplete="tel"
                        />
                      </FormControl>
                      <FormDescription className="text-center">
                        Enter the M-Pesa registered phone number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="text-center">
                      <FormLabel className="flex items-center justify-center gap-2">
                        <span className="font-bold">KES</span>
                        Amount
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 1000"
                          {...field}
                          className="bg-gray-50 text-center"
                          type="text"
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormDescription className="text-center">
                        Enter the amount to pay (KES)
                      </FormDescription>
                      <FormMessage className="text-center" />
                    </FormItem>
                  )}
                />

                <CardFooter className="flex justify-center p-0">
                  <Button 
                    type="submit" 
                    className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 flex items-center justify-center gap-2"
                    disabled={paymentStatus === "loading"}
                  >
                    {paymentStatus === "loading" ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </span>
                    ) : paymentStatus === "success" ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Payment Sent
                      </span>
                    ) : paymentStatus === "error" ? (
                      <span className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Retry Payment
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Pay Now <ArrowRight className="h-5 w-5" />
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* History Link */}
        <div className="mt-4 text-center">
          <Link to="/history">
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              View Transaction History
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Secure payments powered by M-Pesa</p>
        <p className="mt-1">© {new Date().getFullYear()} M-Pesa Simplicity</p>
      </div>
    </div>
  );
};

export default Index;
