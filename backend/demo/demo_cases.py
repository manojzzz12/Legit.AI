"""Three predefined demo scenarios.

These are RAW inputs only: claims, evidence text and the classification a model would
produce. Reliability, trust score, confidence and decision are NOT stored here - they
are calculated by the real scoring engine every time a demo is loaded.

Demo 1 uses real, well-known facts (sources are simulated retrievals).
Demos 2 and 3 use fictional events and fictional ".example" domains so nothing is
falsely attributed to a real outlet.
"""

SIM = "Demo fixture (simulated search) + rule-based source scoring + simulated classification"


def _ev(id, title, url, domain, snippet, cls, reasoning, content_type="news article", offset=3):
    return {"id": id, "title": title, "url": url, "domain": domain, "snippet": snippet,
            "classification": cls, "reasoning": reasoning, "content_type": content_type,
            "processing_method": SIM, "retrieved_offset_s": offset}


DEMO_CASES = {
    # ------------------------------------------------------------------ DEMO 1
    "demo1": {
        "id": "demo1",
        "label": "Genuine content",
        "tagline": "A well-documented space milestone, backed by independent sources.",
        "expected": "TRUSTED",
        "input": {
            "type": "text",
            "title": "Statement about Chandrayaan-3",
            "text": ("ISRO's Chandrayaan-3 lander touched down near the Moon's south polar region on "
                     "23 August 2023, making India the fourth country to achieve a soft landing on the "
                     "Moon. It was a proud moment for the whole nation."),
            "extraction_method": "Pasted text (no extraction needed)",
            "metadata": {},
        },
        "manipulation": {"applicable": False, "indicators": [],
                         "note": "Plain text has no media to analyse, so this signal is skipped "
                                 "and its weight is redistributed to the other signals."},
        "claims": [
            {"id": "c1", "importance": "high", "type": "factual",
             "claim": "Chandrayaan-3's lander touched down near the lunar south polar region on 23 August 2023.",
             "search_query": "Chandrayaan-3 landing date lunar south pole",
             "evidence": [
                 _ev("e1", "Chandrayaan-3 mission update: soft landing achieved", "https://www.isro.gov.in/demo-evidence/ch3-landing",
                     "isro.gov.in", "The mission operator records the lander's soft landing on the Moon on 23 August 2023, near the south polar region.",
                     "SUPPORTS", "Primary source from the mission operator; it states both the date and the region.", "press release", 2),
                 _ev("e2", "NASA congratulates India on Moon landing", "https://www.nasa.gov/demo-evidence/ch3-congratulations",
                     "nasa.gov", "NASA congratulated ISRO on the successful landing near the Moon's south pole.",
                     "SUPPORTS", "An independent space agency confirms the event and the location.", "agency statement", 4),
                 _ev("e3", "India lands spacecraft near Moon's south pole", "https://www.reuters.com/demo-evidence/india-moon-landing",
                     "reuters.com", "International wire report on the 23 August 2023 touchdown near the lunar south pole.",
                     "SUPPORTS", "Independent news agency reports matching date and location.", "news article", 5),
                 _ev("e4", "Chandrayaan-3 makes historic landing", "https://www.bbc.com/demo-evidence/chandrayaan-3-historic",
                     "bbc.com", "Coverage of the landing on 23 August 2023 near the Moon's south polar region.",
                     "SUPPORTS", "A second independent news organisation confirms the same facts.", "news article", 6),
                 _ev("e5", "Backyard telescope tips for this month", "https://stargazer-notes.example/moon-tips",
                     "stargazer-notes.example", "A hobby blog about observing the Moon from home. It does not mention any landing.",
                     "NEUTRAL", "Mentions the Moon but says nothing about the claim.", "blog post", 7),
             ]},
            {"id": "c2", "importance": "medium", "type": "factual",
             "claim": "India became the fourth country to achieve a soft landing on the Moon.",
             "search_query": "India fourth country soft landing Moon",
             "evidence": [
                 _ev("e6", "India joins elite lunar club", "https://www.reuters.com/demo-evidence/fourth-country",
                     "reuters.com", "Reports India as the fourth country to land softly on the Moon after the US, the Soviet Union and China.",
                     "SUPPORTS", "States the ranking explicitly and names the earlier three.", "news article", 8),
                 _ev("e7", "Which countries have landed on the Moon?", "https://www.planetary.org/demo-evidence/moon-landings",
                     "planetary.org", "Lists the four countries that have achieved soft landings: the US, USSR, China and India.",
                     "SUPPORTS", "Space-education organisation gives the same list.", "explainer", 9),
                 _ev("e8", "India's Moon landing: what it means", "https://www.bbc.com/demo-evidence/what-it-means",
                     "bbc.com", "Describes India as the fourth nation to reach the lunar surface intact.",
                     "SUPPORTS", "Independent confirmation of the same ranking.", "news article", 10),
             ]},
            {"id": "c3", "importance": "low", "type": "opinion",
             "claim": "It was a proud moment for the whole nation.", "search_query": None, "evidence": []},
        ],
    },

    # ------------------------------------------------------------------ DEMO 2
    "demo2": {
        "id": "demo2",
        "label": "Suspicious / manipulated content",
        "tagline": "A forwarded 'official notice' image with edit traces and contradicting sources.",
        "expected": "HIGH RISK",
        "input": {
            "type": "image",
            "title": "Forwarded image: 'ATMs closed for 10 days'",
            "text": "",
            "ocr_text": ("BREAKING!! Ministry of Finance NOTICE: ALL ATMs across India will remain CLOSED for 10 DAYS "
                         "starting tomorrow. Withdraw your cash NOW. Banks will run out of cash by tonight. "
                         "FORWARD TO EVERYONE!"),
            "extraction_method": "Simulated Tesseract OCR (demo fixture)",
            "metadata": {"File name": "notice_final_FORWARDED.jpg", "Format": "JPEG", "Dimensions": "1080 x 1350",
                         "EXIF data": "Not present", "Original source": "Unknown"},
        },
        "manipulation": {"applicable": True, "note": "Indicators are signals worth checking. They are not proof of tampering.",
                         "indicators": [
            {"name": "No camera or editing metadata", "severity": 0.4, "detected": True,
             "detail": "The file carries no EXIF data. This is common for screenshots and forwarded images, so it is only a weak signal.",
             "method": "Pillow EXIF read (simulated result)"},
            {"name": "Uneven compression across regions", "severity": 0.7, "detected": True,
             "detail": "The headline area recompresses differently from the background, which can happen when text is pasted over an image.",
             "method": "OpenCV error-level analysis (simulated result)"},
            {"name": "Repeated JPEG recompression", "severity": 0.5, "detected": True,
             "detail": "Blocking artefacts suggest the file was saved several times, which is typical of widely forwarded images.",
             "method": "OpenCV block-artefact check (simulated result)"},
            {"name": "Sharpness mismatch around the headline", "severity": 0.6, "detected": True,
             "detail": "Edges around the headline are sharper than the rest of the image.",
             "method": "OpenCV Laplacian variance (simulated result)"},
            {"name": "Face-swap checks", "severity": 0.0, "detected": False,
             "detail": "No faces were found, so face-based checks do not apply.",
             "method": "OpenCV face detector (simulated result)"},
        ]},
        "claims": [
            {"id": "c1", "importance": "high", "type": "factual",
             "claim": "All ATMs across India will be closed for 10 days starting tomorrow.",
             "search_query": "nationwide ATM closure 10 days notice",
             "evidence": [
                 _ev("e1", "Clarification: no nationwide ATM shutdown has been announced", "https://finance-ministry.gov.example/clarifications/atm-rumour",
                     "finance-ministry.gov.example", "The ministry states that no instruction to close ATMs has been issued and asks the public to ignore the message.",
                     "CONTRADICTS", "An official body denies the notice directly.", "official clarification", 2),
                 _ev("e2", "Banks and ATMs operating normally, regulator says", "https://bank-regulator.gov.example/press/atm-services-normal",
                     "bank-regulator.gov.example", "The banking regulator says ATM services continue as usual and the circulating notice is not genuine.",
                     "CONTRADICTS", "A second official source says services are normal.", "press release", 4),
                 _ev("e3", "Fact check: viral '10-day ATM closure' notice is false", "https://factcheck-desk.example/atm-closure-notice",
                     "factcheck-desk.example", "A fact-checking desk traced the image to an edited template and found no matching official notice.",
                     "CONTRADICTS", "An independent fact-checker reaches the same conclusion by a different route.", "fact check", 5),
                 _ev("e4", "Insider: withdraw cash now, ATMs shutting down", "https://viral-buzz-blog.example/atm-shutdown-insider",
                     "viral-buzz-blog.example", "An anonymous 'insider' says ATMs will shut down. No document or named source is provided.",
                     "SUPPORTS", "Repeats the claim but offers no verifiable evidence.", "blog post", 6),
                 _ev("e5", "Forwarded message repeating the claim", None,
                     "facebook.com", "A screenshot of a forwarded post repeating the notice. No source is cited.",
                     "SUPPORTS", "Repeats the claim; this is circulation, not independent confirmation.", "social media post", 7),
             ]},
            {"id": "c2", "importance": "medium", "type": "factual",
             "claim": "The Ministry of Finance issued an official notice announcing the closure.",
             "search_query": "finance ministry notice ATM closure official",
             "evidence": [
                 _ev("e6", "Official notices archive: no matching ATM notice", "https://finance-ministry.gov.example/notices",
                     "finance-ministry.gov.example", "The ministry's notice archive lists no ATM closure order for the period.",
                     "CONTRADICTS", "The issuing body's own records show no such notice.", "official archive", 8),
                 _ev("e7", "Fact check: the 'ministry notice' uses a copied letterhead", "https://factcheck-desk.example/atm-closure-notice#letterhead",
                     "factcheck-desk.example", "The letterhead in the image matches an older public document, suggesting it was copied.",
                     "CONTRADICTS", "Explains how the notice appears to have been fabricated.", "fact check", 9),
                 _ev("e8", "Notice 'leaked' from internal circular", "https://viral-buzz-blog.example/leaked-circular",
                     "viral-buzz-blog.example", "Says the notice came from an internal circular but shows no copy of it.",
                     "SUPPORTS", "Asserts an origin without proof.", "blog post", 10),
             ]},
            {"id": "c3", "importance": "medium", "type": "prediction",
             "claim": "Banks will run out of cash by tonight.", "search_query": None, "evidence": []},
        ],
    },

    # ------------------------------------------------------------------ DEMO 3
    "demo3": {
        "id": "demo3",
        "label": "Conflicting evidence",
        "tagline": "Reliable sources disagree about whether a metro line opened on the stated date.",
        "expected": "INCONCLUSIVE",
        "input": {
            "type": "video",
            "title": "Clip: Metro Phase 2 opening remarks",
            "text": "",
            "transcript": ("Good morning everyone. As you all know, the Greenfield Metro Phase 2 line opened to passengers "
                           "on fifteenth March, and daily ridership has already crossed one lakh. Honestly, it is the best "
                           "public transport project this city has seen in a decade."),
            "extraction_method": "Simulated FFmpeg audio extraction + speech-to-text (demo fixture)",
            "frames": [
                {"timestamp": "00:02", "description": "Speaker at a podium. A banner reads 'Greenfield Metro Phase 2'."},
                {"timestamp": "00:07", "description": "Train arriving at a station platform."},
                {"timestamp": "00:12", "description": "Close-up of the speaker, lighting consistent with the first frame."},
            ],
            "metadata": {"Duration": "00:15", "Container": "MP4 (H.264)", "Frames sampled": "3 of ~450",
                         "Recording date": "Not present in file"},
        },
        "manipulation": {"applicable": True, "note": "Indicators are signals worth checking. They are not proof of tampering.",
                         "indicators": [
            {"name": "Audio and video sync", "severity": 0.0, "detected": False,
             "detail": "No offset between speech and lip movement was found in the sampled frames.",
             "method": "FFmpeg timing check (simulated result)"},
            {"name": "Lighting consistency", "severity": 0.0, "detected": False,
             "detail": "Colour and lighting are consistent across the three sampled frames.",
             "method": "OpenCV histogram comparison (simulated result)"},
            {"name": "Re-encoded container", "severity": 0.15, "detected": True,
             "detail": "The file was re-encoded, which is normal for clips shared through messaging apps.",
             "method": "FFmpeg stream info (simulated result)"},
            {"name": "Limited frame sampling", "severity": 0.1, "detected": True,
             "detail": "Only 3 frames were checked, so most of the video was not analysed.",
             "method": "Pipeline limitation"},
        ]},
        "claims": [
            {"id": "c1", "importance": "high", "type": "factual",
             "claim": "Greenfield Metro Phase 2 opened to passengers on 15 March.",
             "search_query": "Greenfield Metro Phase 2 opening date passengers",
             "evidence": [
                 _ev("e1", "Phase 2 opens to commuters, first trains packed", "https://greenfield-herald.example/metro-phase-2-opens",
                     "greenfield-herald.example", "Reports commuters riding the new line on 15 March.",
                     "SUPPORTS", "States passengers used the line on the claimed date.", "news article", 2),
                 _ev("e2", "First day on Phase 2: thousands ride the new line", "https://city-news-network.example/phase-2-first-day",
                     "city-news-network.example", "Describes large crowds on the new line during its first week of service in mid-March.",
                     "SUPPORTS", "Consistent with an opening in mid-March, though it does not give the exact day.", "news article", 4),
                 _ev("e3", "Council welcomes new Phase 2 service", "https://transit-council.example/statements/phase-2",
                     "transit-council.example", "A transport advocacy council welcomes the line, which it says began carrying passengers in mid-March.",
                     "SUPPORTS", "Relies on the same timeframe as the news reports.", "statement", 5),
                 _ev("e4", "Notice: Phase 2 trial operations and public opening date", "https://greenfield-metro.gov.example/notices/phase-2",
                     "greenfield-metro.gov.example", "Says trial operations began on 15 March and that regular public passenger service starts on 2 April.",
                     "CONTRADICTS", "The operator dates public service to 2 April. The two accounts may describe trial rides versus public service, so the conflict cannot be settled from these sources.",
                     "official notice", 6),
                 _ev("e5", "Riders discuss platform crowding and fares", "https://metro-riders-forum.example/threads/phase-2",
                     "metro-riders-forum.example", "A forum thread about crowded platforms and ticket prices. It gives no opening date.",
                     "NEUTRAL", "Related topic, but silent on the date in question.", "forum thread", 7),
             ]},
            {"id": "c2", "importance": "low", "type": "factual",
             "claim": "Daily ridership on Phase 2 has already crossed one lakh.",
             "search_query": "Greenfield Metro Phase 2 daily ridership",
             "evidence": [
                 _ev("e6", "Ridership figures yet to be published, officials say", "https://city-news-network.example/ridership-figures",
                     "city-news-network.example", "Officials say passenger counts are still being compiled.",
                     "NEUTRAL", "Neither confirms nor denies the figure.", "news article", 8),
                 _ev("e7", "Heard it's over a lakh a day!", None,
                     "facebook.com", "An unsourced social media comment repeating the figure.",
                     "SUPPORTS", "Repeats the number with no source.", "social media post", 9),
             ]},
            {"id": "c3", "importance": "low", "type": "opinion",
             "claim": "It is the best public transport project this city has seen in a decade.",
             "search_query": None, "evidence": []},
        ],
    },
}
