import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <RegisterForm initialSlug={slug ?? ""} />;
}
