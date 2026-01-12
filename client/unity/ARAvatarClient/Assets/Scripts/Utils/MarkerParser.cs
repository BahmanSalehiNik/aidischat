using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace AIChatAR.Utils
{
    /// <summary>
    /// Marker parser - matches React Native markerParser.ts
    /// Parses emotion/gesture/pose/tone markers from text
    /// </summary>
    public static class MarkerParser
    {
        /// <summary>
        /// Marker types matching React Native
        /// </summary>
        public enum MarkerType
        {
            Emotion,
            Movement,
            Gesture,
            Pose,
            Tone
        }

        /// <summary>
        /// Marker data structure
        /// </summary>
        [Serializable]
        public class Marker
        {
            public MarkerType type;
            public string value;
        }

        /// <summary>
        /// Parsed chunk with clean text and markers
        /// </summary>
        [Serializable]
        public class ParsedChunk
        {
            public string text;
            public List<Marker> markers;
        }

        /// <summary>
        /// Parse markers from text - matches parseMarkers() in React Native
        /// Example: "[emotion:happy]Hello! [gesture:wave]How are you?"
        /// </summary>
        public static ParsedChunk ParseMarkers(string text)
        {
            List<Marker> markers = new List<Marker>();
            string cleanText = text;

            // Match [type:value] or [type1:value1,type2:value2]
            Regex markerRegex = new Regex(@"\[([^\]]+)\]");

            cleanText = markerRegex.Replace(text, match =>
            {
                string content = match.Groups[1].Value;
                
                // Parse comma-separated markers
                string[] parts = content.Split(',');
                foreach (string part in parts)
                {
                    string[] keyValue = part.Split(':');
                    if (keyValue.Length == 2)
                    {
                        string typeStr = keyValue[0].Trim();
                        string value = keyValue[1].Trim();

                        // Validate and convert marker type
                        if (Enum.TryParse<MarkerType>(typeStr, true, out MarkerType markerType))
                        {
                            markers.Add(new Marker
                            {
                                type = markerType,
                                value = value
                            });
                        }
                        else
                        {
                            Debug.LogWarning($"Unknown marker type: {typeStr}");
                        }
                    }
                }
                return ""; // Remove marker from text
            });

            return new ParsedChunk
            {
                text = cleanText.Trim(),
                markers = markers
            };
        }

        /// <summary>
        /// Extract markers sequentially with positions - matches extractMarkersSequentially()
        /// </summary>
        public static List<MarkerPosition> ExtractMarkersSequentially(string text)
        {
            List<MarkerPosition> result = new List<MarkerPosition>();
            Regex markerRegex = new Regex(@"\[([^\]]+)\]");

            MatchCollection matches = markerRegex.Matches(text);
            foreach (Match match in matches)
            {
                int position = match.Index;
                string content = match.Groups[1].Value;
                List<Marker> markers = new List<Marker>();

                // Parse comma-separated markers
                string[] parts = content.Split(',');
                foreach (string part in parts)
                {
                    string[] keyValue = part.Split(':');
                    if (keyValue.Length == 2)
                    {
                        string typeStr = keyValue[0].Trim();
                        string value = keyValue[1].Trim();

                        if (Enum.TryParse<MarkerType>(typeStr, true, out MarkerType markerType))
                        {
                            markers.Add(new Marker
                            {
                                type = markerType,
                                value = value
                            });
                        }
                    }
                }

                if (markers.Count > 0)
                {
                    result.Add(new MarkerPosition
                    {
                        position = position,
                        markers = markers
                    });
                }
            }

            return result;
        }

        /// <summary>
        /// Get last marker of specific type
        /// </summary>
        public static Marker GetLastMarker(ParsedChunk chunk, MarkerType type)
        {
            for (int i = chunk.markers.Count - 1; i >= 0; i--)
            {
                if (chunk.markers[i].type == type)
                {
                    return chunk.markers[i];
                }
            }
            return null;
        }

        /// <summary>
        /// Get all markers of specific type
        /// </summary>
        public static List<Marker> GetMarkersByType(ParsedChunk chunk, MarkerType type)
        {
            List<Marker> result = new List<Marker>();
            foreach (Marker marker in chunk.markers)
            {
                if (marker.type == type)
                {
                    result.Add(marker);
                }
            }
            return result;
        }

        [Serializable]
        public class MarkerPosition
        {
            public int position;
            public List<Marker> markers;
        }
    }
}

