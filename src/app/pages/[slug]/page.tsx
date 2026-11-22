 import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface Props {
  params: Promise<{ slug: string }>;
}

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
  }>;
  content?: TiptapNode[];
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value, "https://www.ibuydeals.africa");

    if (!["http:", "https:"].includes(url.protocol)) return null;

    return value;
  } catch {
    return null;
  }
}

function renderText(node: TiptapNode): ReactNode {
  let result: ReactNode = node.text || "";

  for (const mark of node.marks || []) {
    switch (mark.type) {
      case "bold":
        result = <strong>{result}</strong>;
        break;

      case "italic":
        result = <em>{result}</em>;
        break;

      case "underline":
        result = <u>{result}</u>;
        break;

      case "strike":
        result = <s>{result}</s>;
        break;

      case "link": {
        const href = safeUrl(mark.attrs?.href);

        if (href) {
          result = (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ibuy-primary underline"
            >
              {result}
            </a>
          );
        }

        break;
      }
    }
  }

  return result;
}

function renderNode(node: TiptapNode, index: number): ReactNode {
  const children = node.content?.map((child, i) =>
    renderNode(child, i)
  );

  switch (node.type) {
    case "text":
      return <span key={index}>{renderText(node)}</span>;

    case "paragraph":
      return (
        <p key={index} className="mb-5 leading-8">
          {children}
        </p>
      );

    case "heading": {
      const level = Number(node.attrs?.level || 2);

      if (level === 1) {
        return <h1 key={index} className="mb-5 mt-8 text-3xl font-bold">{children}</h1>;
      }

      if (level === 3) {
        return <h3 key={index} className="mb-3 mt-6 text-xl font-semibold">{children}</h3>;
      }

      return <h2 key={index} className="mb-4 mt-7 text-2xl font-bold">{children}</h2>;
    }

    case "bulletList":
      return (
        <ul key={index} className="mb-5 list-disc space-y-2 pl-7">
          {children}
        </ul>
      );

    case "orderedList":
      return (
        <ol key={index} className="mb-5 list-decimal space-y-2 pl-7">
          {children}
        </ol>
      );

    case "listItem":
      return <li key={index}>{children}</li>;

    case "blockquote":
      return (
        <blockquote key={index} className="my-6 border-l-4 border-ibuy-primary pl-5 italic text-gray-600">
          {children}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre key={index} className="my-5 overflow-x-auto rounded-xl bg-gray-100 p-4 text-sm">
          <code>{children}</code>
        </pre>
      );

    case "horizontalRule":
      return <hr key={index} className="my-8 border-gray-200" />;

    case "image": {
      const src = safeUrl(node.attrs?.src);

      if (!src) return null;

      return (
        <figure key={index} className="my-8">
          <img
            src={src}
            alt={String(node.attrs?.alt || "")}
            className="h-auto max-h-[600px] w-full rounded-xl object-contain"
          />
          {node.attrs?.title ? (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {String(node.attrs.title)}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "youtube": {
      const src = node.attrs?.src;

      if (typeof src !== "string") return null;

      try {
        const url = new URL(src);

        const allowedHosts = [
          "youtube.com",
          "www.youtube.com",
          "youtu.be",
          "www.youtube-nocookie.com",
        ];

        if (!allowedHosts.includes(url.hostname)) return null;

        let videoId = "";

        if (url.hostname.includes("youtu.be")) {
          videoId = url.pathname.slice(1);
        } else {
          videoId = url.searchParams.get("v") || "";
        }

        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

        return (
          <div key={index} className="my-8 aspect-video overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title="YouTube video"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        );
      } catch {
        return null;
      }
    }

    default:
      return children || null;
  }
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const page = await db.contentPage.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
    select: {
      title: true,
      seoTitle: true,
      seoDescription: true,
      excerpt: true,
      coverImage: true,
    },
  });

  if (!page) return {};

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt || undefined,
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || page.excerpt || undefined,
      images: page.coverImage ? [page.coverImage] : [],
    },
  };
}

export default async function PublicContentPage({ params }: Props) {
  const { slug } = await params;

  const page = await db.contentPage.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
  });

  if (!page) notFound();

  const content = page.content as unknown as TiptapNode;

  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {page.title}
          </h1>

          {page.excerpt && (
            <p className="mt-5 text-lg leading-8 text-gray-500">
              {page.excerpt}
            </p>
          )}
        </header>

        {page.coverImage && (
          <img
            src={page.coverImage}
            alt={page.title}
            className="mb-10 max-h-[480px] w-full rounded-2xl object-cover"
          />
        )}

        <div className="prose max-w-none text-base text-gray-800">
          {content.content?.map((node, index) =>
            renderNode(node, index)
          )}
        </div>

      </article>
    </main>
  );
}