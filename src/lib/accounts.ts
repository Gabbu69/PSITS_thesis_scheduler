import { z } from "zod";

export const realEmail = z.email().trim().toLowerCase().refine((email) => {
  const domain = email.split("@")[1];
  return !/(^|\.)(test|invalid|example|localhost)$/.test(domain) &&
    !["example.com", "example.org", "example.net"].includes(domain);
}, "Enter a real email address. Test and example addresses cannot be used.");
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const setupSchema = z.object({
  key: z.string().min(32),
  college: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(200),
  email: realEmail,
  password: passwordSchema,
});
