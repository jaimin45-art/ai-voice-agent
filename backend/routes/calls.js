const express = require("express");
const axios = require("axios");
const supabase = require("../lib/supabase");

const router = express.Router();

// CREATE OUTBOUND CALL

router.post("/outbound", async (req, res) => {
  console.log("OUTBOUND HIT");
  console.log(req.body);

  const {
    owner_name,
    property_address,
    lead_source,
    to_number,
  } = req.body;

  if (!owner_name || !property_address || !to_number) {
    return res.status(400).json({
      error: "owner_name, property_address and to_number are required",
    });
  }

  const agent_name = process.env.AGENT_NAME || "Alex";

  try {
   
    // Create Retell Call
   
    const { data: callData } = await axios.post(
      "https://api.retellai.com/v2/create-phone-call",
      {
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number,
        agent_id: process.env.RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          owner_name,
          property_address,
          lead_source: lead_source || "our website enquiry form",
          agent_name,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("========== RETELL RESPONSE ==========");
    console.log(callData);

    
    // Save Immediately
    
    const { error } = await supabase
      .from("calls")
      .upsert(
        {
          call_id: callData.call_id,
          owner_name,
          property_address,
          lead_source: lead_source || "our website enquiry form",
          agent_name,
          to_number,
          status: "initiated",
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "call_id",
        }
      );

    if (error) {
      console.error("SUPABASE ERROR:", error);
    }

    return res.status(201).json({
      success: true,
      call_id: callData.call_id,
      status: callData.call_status || "initiated",
      message: `Outbound call initiated to ${owner_name}`,
    });

  } catch (err) {
    console.error(
      "RETELL ERROR:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      error: "Failed to initiate outbound call",
      details: err.response?.data || err.message,
    });
  }
});


// GET ALL CALLS

router.get("/", async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;

  const { data, error, count } = await supabase
    .from("calls")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.json({
    calls: data,
    total: count,
    limit,
    offset,
  });
});


// GET SINGLE CALL

router.get("/:call_id", async (req, res) => {
  const { call_id } = req.params;

  const { data: call, error } = await supabase
    .from("calls")
    .select("*")
    .eq("call_id", call_id)
    .single();

  if (error || !call) {
    return res.status(404).json({
      error: "Call not found",
    });
  }

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("*")
    .eq("call_id", call_id)
    .order("sequence", { ascending: true });

  if (transcriptError) {
    console.error("TRANSCRIPT FETCH ERROR:", transcriptError);
  }

  return res.json({
    call,
    transcript: transcript || [],
  });
});

module.exports = router;