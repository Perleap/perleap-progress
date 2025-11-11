-- Add materials field to assignments table to store PDFs and links
-- Structure: [{ type: "pdf" | "link", url: "...", name: "..." }]

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the field
COMMENT ON COLUMN public.assignments.materials IS 'JSON array of course materials (PDFs/links) for this assignment. Structure: [{type: "pdf"|"link", url: "...", name: "..."}]';

-- Create index for better query performance when filtering by materials
CREATE INDEX IF NOT EXISTS idx_assignments_materials ON public.assignments USING gin (materials);

