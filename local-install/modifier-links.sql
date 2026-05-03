-- Island Tacos — Modifier Links Patch
-- Run this after menu-import.sql and menu-patch.sql
-- Links each menu item to its modifier groups via loyverse_modifier_ids

UPDATE menu_items SET loyverse_modifier_ids = ARRAY['c89b98e5-9c50-4194-8754-7bd88e59ff58','033d3fe5-e35c-4f74-a053-70273108660d','12efde72-897e-4884-9ef4-23aae9c47788','92376cda-d3d0-44b0-ad7c-373a93a4c0e0','64d00723-cfcb-4280-94aa-907f0ea5d70f'] WHERE id IN (68,69,70);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['c89b98e5-9c50-4194-8754-7bd88e59ff58','12efde72-897e-4884-9ef4-23aae9c47788','92376cda-d3d0-44b0-ad7c-373a93a4c0e0','64d00723-cfcb-4280-94aa-907f0ea5d70f'] WHERE id IN (71,74);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['919039a4-71b4-11ea-8d93-0603130a05b8','e49796b9-9695-4228-bf20-6fdfea44745a','033d3fe5-e35c-4f74-a053-70273108660d'] WHERE id IN (75,76);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['919039a4-71b4-11ea-8d93-0603130a05b8','96b590f5-9b1b-4719-861b-e4463bb1bc74'] WHERE id = 77;
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['919039a4-71b4-11ea-8d93-0603130a05b8','c89b98e5-9c50-4194-8754-7bd88e59ff58','96b590f5-9b1b-4719-861b-e4463bb1bc74'] WHERE id IN (78,79,80);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['419b1284-364f-4cdc-b591-4fa685eeb888','a369b587-8a4b-4415-be15-528bc1bda7f3'] WHERE id IN (82,89);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['919039a4-71b4-11ea-8d93-0603130a05b8','c89b98e5-9c50-4194-8754-7bd88e59ff58','e49796b9-9695-4228-bf20-6fdfea44745a','033d3fe5-e35c-4f74-a053-70273108660d','12efde72-897e-4884-9ef4-23aae9c47788'] WHERE id IN (83,84,85,86,87);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['12efde72-897e-4884-9ef4-23aae9c47788','98b21c87-75da-47bd-8abc-dc58ed97a88b'] WHERE id IN (90,91,92,93);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['c89b98e5-9c50-4194-8754-7bd88e59ff58','12efde72-897e-4884-9ef4-23aae9c47788','b336ffc8-df22-4ec3-ac5b-1d8097b914cb','3ed38de5-0bef-4dc0-add6-a6c7667875c5'] WHERE id IN (94,101,113,114,115);
UPDATE menu_items SET loyverse_modifier_ids = ARRAY['919039a4-71b4-11ea-8d93-0603130a05b8','c89b98e5-9c50-4194-8754-7bd88e59ff58','e49796b9-9695-4228-bf20-6fdfea44745a','24031d50-2694-4a84-9576-89c913944268','033d3fe5-e35c-4f74-a053-70273108660d','12efde72-897e-4884-9ef4-23aae9c47788'] WHERE id IN (95,96,98,99,100,102,103,104,105,107,110,111,112,116,117);
