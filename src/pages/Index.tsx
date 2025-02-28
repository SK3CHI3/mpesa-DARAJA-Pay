
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { CreditCard, PhoneCall, ArrowRight, CheckCircle } from "lucide-react";
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
      
      // Call our Supabase Edge Function to initiate the STK Push
      const response = await fetch(
        "https://evghwzipbhnwhwkshumt.functions.supabase.co/initiate-stk-push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: values.phoneNumber,
            amount: values.amount,
          }),
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to process payment");
      }
      
      setPaymentStatus("success");
      toast({
        title: "Payment initiated",
        description: `KES ${values.amount} payment request sent to ${values.phoneNumber}`,
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
      // Reset payment status after 3 seconds
      setTimeout(() => {
        setPaymentStatus("idle");
      }, 3000);
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
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Secure payments powered by M-Pesa</p>
        <p className="mt-1">© {new Date().getFullYear()} M-Pesa Simplicity</p>
      </div>
    </div>
  );
};

export default Index;
