import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { ChevronLeft } from 'lucide-react';

type Page = {
  _id: string;
  title: string;
  slug: string;
  content: string;
};

export default function PageView() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    api.get(`/pages/slug/${slug}`)
      .then((r) => setPage(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (error || !page) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black">Page Not Found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back to Home</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary mb-6">
          <ChevronLeft className="h-4 w-4" /> Back to Home
        </Link>
        <h1 className="font-display text-3xl font-black text-foreground mb-6">{page.title}</h1>
        <div className="prose prose-invert max-w-none text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {page.content}
        </div>
      </div>
    </div>
  );
}
