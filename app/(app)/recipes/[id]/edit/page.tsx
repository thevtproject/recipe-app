import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { RecipeForm } from '@/components/recipe/RecipeForm';

type Step = { order: number; instruction: string };

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) notFound();

  const isOwner = recipe.authorId === session.user.id;
  const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
  if (!isOwner && !isAdmin) redirect('/recipes');

  return (
    <RecipeForm
      mode="edit"
      recipeId={recipe.id}
      defaultValues={{
        title: recipe.title,
        description: recipe.description ?? undefined,
        category: recipe.category as 'BREAKFAST' | 'LUNCH' | 'DINNER',
        photoUrl: recipe.photoUrl,
        steps: recipe.steps as Step[],
      }}
    />
  );
}
