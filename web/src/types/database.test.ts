import { describe, it, expect } from "vitest";
import type { Database, ActivityEventType } from "./database";

describe("Database Types", () => {
  describe("research_briefs table type", () => {
    it("has correct Row type structure", () => {
      // Type-level test: this won't fail at runtime but validates the types exist
      type BriefRow = Database["public"]["Tables"]["research_briefs"]["Row"];

      // Create a mock that satisfies the type
      const mockRow: BriefRow = {
        id: "uuid-1",
        agent_id: "agent-uuid",
        property_id: "prop-uuid",
        buyer_id: null,
        trigger_type: "email",
        trigger_source_id: null,
        brief_content: "Brief content here",
        simplified_content: "Simple version",
        enrichment_snapshot: {},
        confidence_level: "high",
        data_sources: ["RentCast AVM", "Walk Score"],
        comp_count: 3,
        delivered_via: "gmail_draft",
        gmail_draft_id: "draft-123",
        delivered_at: null,
        viewed_at: null,
        public_token: "abc123hex",
        created_at: "2026-01-01T00:00:00Z",
      };

      expect(mockRow.id).toBe("uuid-1");
      expect(mockRow.agent_id).toBe("agent-uuid");
      expect(mockRow.data_sources).toHaveLength(2);
      expect(mockRow.comp_count).toBe(3);
    });

    it("has correct Insert type (minimal required fields)", () => {
      type BriefInsert = Database["public"]["Tables"]["research_briefs"]["Insert"];

      const minimalInsert: BriefInsert = {
        agent_id: "agent-uuid",
        property_id: "prop-uuid",
        trigger_type: "email",
      };

      expect(minimalInsert.agent_id).toBe("agent-uuid");
      expect(minimalInsert.property_id).toBe("prop-uuid");
      expect(minimalInsert.trigger_type).toBe("email");
    });

    it("Insert type allows optional fields", () => {
      type BriefInsert = Database["public"]["Tables"]["research_briefs"]["Insert"];

      const fullInsert: BriefInsert = {
        agent_id: "agent-uuid",
        property_id: "prop-uuid",
        trigger_type: "manual",
        buyer_id: "buyer-uuid",
        brief_content: "Content",
        simplified_content: "Simple",
        enrichment_snapshot: { walkability: { walk_score: 78 } },
        confidence_level: "high",
        data_sources: ["source1"],
        comp_count: 5,
        delivered_via: "gmail_draft",
        gmail_draft_id: "draft-1",
      };

      expect(fullInsert.buyer_id).toBe("buyer-uuid");
      expect(fullInsert.comp_count).toBe(5);
    });
  });

  describe("ActivityEventType includes research events", () => {
    it("includes research_brief_created", () => {
      const eventType: ActivityEventType = "research_brief_created";
      expect(eventType).toBe("research_brief_created");
    });

    it("includes research_completed (pre-existing)", () => {
      const eventType: ActivityEventType = "research_completed";
      expect(eventType).toBe("research_completed");
    });

    it("includes research_started (pre-existing)", () => {
      const eventType: ActivityEventType = "research_started";
      expect(eventType).toBe("research_started");
    });
  });
});
