const express = require("express");
const { verifyRetellSignature } = require("../middleware/retellAuth");
const supabase = require("../lib/supabase");

const router = express.Router();

router.post("/retell", verifyRetellSignature, async (req, res) => {
  const event = req.body;
  const { event: eventType, call } = event;

  console.log(`📞 Retell webhook: ${eventType} | call_id: ${call?.call_id}`);

  try {

    // CALL STARTED
   
    if (eventType === "call_started") {

      // see calls already exist in database or not ?
      const { data: existing } = await supabase
        .from("calls")
        .select("*")
        .eq("call_id", call.call_id)
        .single();

      if (!existing) {

        const row = {
          call_id: call.call_id,
          owner_name: "Unknown",
          property_address: "Unknown",
          lead_source: "",
          agent_name: call.agent_name || null,
          to_number: call.to_number || null,
          status: "in_progress",
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("calls")
          .insert(row);

        if (error) {
          console.error("INSERT ERROR:", error);
        }

      } else {

        const { error } = await supabase
          .from("calls")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .eq("call_id", call.call_id);

        if (error) {
          console.error(error);
        }

      }
    }

    
    // CALL ENDED
    
    if (eventType === "call_ended") {

      const { error } = await supabase
        .from("calls")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds:
            call.duration_ms
              ? Math.round(call.duration_ms / 1000)
              : null,
          disconnection_reason:
            call.disconnection_reason || null,
        })
        .eq("call_id", call.call_id);

      if (error) {
        console.error(error);
      }

      if (
        call.transcript_object &&
        Array.isArray(call.transcript_object)
      ) {

        const transcript = call.transcript_object.map((u, i) => ({
          call_id: call.call_id,
          sequence: i,
          role: u.role,
          content: u.content,
          words: u.words
            ? JSON.stringify(u.words)
            : null,
        }));

        const { error: transcriptError } = await supabase
          .from("transcripts")
          .upsert(transcript, {
            onConflict: "call_id,sequence",
          });

        if (transcriptError) {
          console.error("TRANSCRIPT ERROR:", transcriptError);
        }

      }

    }

    
    // CALL ANALYZED
    
    if (eventType === "call_analyzed") {

      const analysis = call.call_analysis || {};
      const custom = analysis.custom_analysis_data || {};

      const { error } = await supabase
        .from("calls")
        .update({
          status: "analyzed",
          qualified: custom.qualified || null,
          sell_timeline: custom.sell_timeline || null,
          motivation: custom.motivation || null,
          objections: custom.objections || null,
          follow_up_required:
            custom.follow_up_required ?? null,
          call_sentiment:
            custom.call_sentiment ||
            analysis.user_sentiment ||
            null,
          call_summary:
            analysis.call_summary || null,
          agent_sentiment:
            analysis.agent_sentiment || null,
          analyzed_at: new Date().toISOString(),
        })
        .eq("call_id", call.call_id);

      if (error) {
        console.error(error);
      }

    }

    res.json({ success: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message,
    });

  }

});

module.exports = router;