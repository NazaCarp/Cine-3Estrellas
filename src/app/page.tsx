import CarouselGallery from '@/components/Carousel/CarouselGallery';
import { fetchHomeData } from '@/lib/data';

// Force dynamic to ensure fresh categories on every reload if content changes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import LoginGate from '@/components/Auth/LoginGate';

export default async function Home() {
  const categories = await fetchHomeData();

  return (
    <main>
      <LoginGate>
        <CarouselGallery initialCategories={categories} />
      </LoginGate>
    </main>
  );
}
