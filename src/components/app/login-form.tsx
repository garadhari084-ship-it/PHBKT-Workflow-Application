
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/firebase";
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
import { sendPasswordResetEmail } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function LoginForm() {
  const auth = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    initiateEmailSignIn(auth, values.email, values.password, (error) => {
        toast({
            variant: "destructive",
            title: "Authentication Failed",
            description: error.message,
        });
    });
  }

  const handlePasswordReset = async () => {
    const email = form.getValues('email');
    if (!email) {
      form.setError("email", { type: "manual", message: "Please enter your email to reset the password." });
      return;
    }
    // Manually trigger validation to check if email is valid before sending
    const isEmailValid = await form.trigger("email");
    if (!isEmailValid) {
        return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Please check your inbox for password reset instructions.',
      });
    } catch (error: any) {
        if(error.code === 'auth/user-not-found') {
             toast({
                variant: "destructive",
                title: 'User Not Found',
                description: "No user found with this email address.",
             });
        } else {
            toast({
                variant: "destructive",
                title: 'Error',
                description: error.message,
            });
        }
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} className="border-zinc-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10 border-zinc-400"
                    {...field}
                  />
                </FormControl>
                <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-500" />
                    ) : (
                        <Eye className="h-5 w-5 text-gray-500" />
                    )}
                </button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2 pt-2">
            <Button type="submit" className="w-full" size="lg">
              Sign In
            </Button>
            <Button type="button" variant="link" className="w-full text-xs p-0 h-auto font-normal text-muted-foreground" onClick={handlePasswordReset}>
              Forgot password?
            </Button>
        </div>
      </form>
    </Form>
  );
}
