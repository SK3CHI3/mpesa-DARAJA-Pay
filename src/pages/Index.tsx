
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
      
      // Simulate API call to M-Pesa
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // This is where you would make the actual API call to the Daraja API
      // const response = await initiateSTKPush(values.phoneNumber, values.amount);
      
      setPaymentStatus("success");
      toast({
        title: "Payment initiated",
        description: `KES ${values.amount} payment request sent to ${values.phoneNumber}`,
      });
    } catch (error) {
      setPaymentStatus("error");
      toast({
        title: "Payment failed",
        description: "Could not process M-Pesa payment request",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
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
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 0712345678"
                          {...field}
                          className="bg-gray-50"
                          autoComplete="tel"
                        />
                      </FormControl>
                      <FormDescription>
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
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <span className="font-bold">KES</span>
                        Amount
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 1000"
                          {...field}
                          className="bg-gray-50"
                          type="text"
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the amount to pay (KES)
                      </FormDescription>
                      <FormMessage />
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

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Secure payments powered by M-Pesa</p>
          <p className="mt-1">© {new Date().getFullYear()} M-Pesa Simplicity</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
