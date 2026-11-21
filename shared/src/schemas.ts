import { z } from "zod";

export const CATEGORY_NAME_MAX = 40;
export const COMMENT_AUTHOR_MAX = 40;
export const COMMENT_BODY_MAX = 1000;
export const ITEM_TITLE_MAX = 200;

/**
 * Only plain web links make sense here. The scheme is checked before anything is fetched, so
 * file:, data: and other schemes never reach the preview fetcher.
 */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(2000, "That link is too long")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full http or https link");

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Name the category")
  .max(CATEGORY_NAME_MAX, `Keep the name under ${CATEGORY_NAME_MAX} characters`);

const titleSchema = z
  .string()
  .max(ITEM_TITLE_MAX, `Keep the title under ${ITEM_TITLE_MAX} characters`)
  .transform((value) => value.trim())
  .transform((value) => (value.length > 0 ? value : null));

export const addItemSchema = z.object({
  url: httpUrlSchema,
  title: titleSchema.optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const updateItemSchema = z.object({
  title: titleSchema.nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const addCommentSchema = z.object({
  author: z
    .string()
    .trim()
    .min(1, "Add your name")
    .max(COMMENT_AUTHOR_MAX, `Keep the name under ${COMMENT_AUTHOR_MAX} characters`),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment")
    .max(COMMENT_BODY_MAX, `Keep the comment under ${COMMENT_BODY_MAX} characters`),
});

export const createCategorySchema = z.object({ name: categoryNameSchema });

export const idSchema = z.string().uuid();