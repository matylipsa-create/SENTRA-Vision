# Aegis → UE5 Integration Guide

> **GameBridge Protocol** — How Aegis sends cognitive events to Unreal Engine 5 via WebSocket.

## Overview

Aegis processes real-world sensor data (BPM, audio, GPS, motion) through three layers of cognitive processing and streams the results to UE5 in real time over WebSocket. UE5 uses these events to drive dynamic world changes — weather, NPC behavior, faction relations, lighting, and more.

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────┐
│  Sensors │ ──> │ STARProcessor │ ──> │ GameBridge   │ ──> │   UE5   │
│ (BPM,    │     │ (energy,      │     │ (WebSocket   │     │ (World  │
│  audio,  │     │  vibration,   │     │  port 17771) │     │  state) │
│  GPS…)   │     │  causality)   │     │              │     │         │
└──────────┘     └───────────────┘     └──────────────┘     └─────────┘
```

## Connection

| Parameter | Value |
|---|---|
| Protocol | WebSocket (`ws://`) |
| Port | `17771` (configurable in Aegis Settings) |
| URL | `ws://<host>:17771` |
| Direction | Aegis → UE5 (one-way, Aegis is the client) |
| Heartbeat | Every 5 seconds |
| Auto-reconnect | 3 seconds after disconnect |
| Offline mode | If connection fails, Aegis continues normally |

The operator toggles the bridge on/off in **Settings → Puente UE5 — GameBridge**.

---

## Message Envelope

Every message shares this top-level structure:

```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "cognitive" | "event" | "heartbeat",
  "data": { ... }
}
```

| Field | Type | Description |
|---|---|---|
| `source` | `"AEGIS"` | Always `"AEGIS"` — identifies the sender |
| `timestamp` | `number` | Unix epoch milliseconds |
| `type` | `string` | Message category: `cognitive`, `event`, or `heartbeat` |
| `data` | `object \| null` | Type-specific payload (see below) |

---

## Message Type 1: `cognitive`

Sent whenever STARProcessor produces a new cognitive reading. This is the continuous data stream.

### Shape

```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "cognitive",
  "data": {
    "energyLevel": 72,
    "vibrationIndex": 45,
    "causalityScore": 81,
    "consciousnessState": "STRESSED",
    "raw": {
      "bpm": 112,
      "audioLevel": 0.65,
      "latitude": 40.4168,
      "longitude": -3.7038,
      "motion": 0.8,
      "respiration": 22,
      "skinConductance": 0.7
    },
    "timestamp": 1722710000000
  }
}
```

### `data` fields

| Field | Type | Range | Description |
|---|---|---|---|
| `energyLevel` | `number` | 0–100 | Aggregate activation energy across all sensors. Higher = more physiological activation. |
| `vibrationIndex` | `number` | 0–100 | Temporal instability — how rapidly the energy level is changing. Higher = more agitated. |
| `causalityScore` | `number` | 0–100 | Coherence of the sensor chain. High = sensors tell a consistent story. Low = contradictory readings. |
| `consciousnessState` | `string` | enum | `CALM` / `ALERT` / `STRESSED` / `CRITICAL` |
| `raw` | `object` | — | Original sensor readings (see below) |
| `timestamp` | `number` | epoch ms | When this reading was processed |

### Consciousness state thresholds

| State | Condition |
|---|---|
| `CALM` | energy < 35 AND vibration < 30 |
| `ALERT` | energy < 60 AND vibration < 50 |
| `STRESSED` | energy < 80 |
| `CRITICAL` | energy >= 80 |

### `raw` sensor fields

All fields are optional (Aegis sends what's available):

| Field | Type | Range | Description |
|---|---|---|---|
| `bpm` | `number` | 30–200 | Heart rate in beats per minute |
| `audioLevel` | `number` | 0.0–1.0 | Normalized ambient audio level |
| `latitude` | `number` | -90 to 90 | GPS latitude |
| `longitude` | `number` | -180 to 180 | GPS longitude |
| `motion` | `number` | 0.0–1.0 | Normalized motion intensity |
| `respiration` | `number` | 8–40 | Breaths per minute |
| `skinConductance` | `number` | 0.0–1.0 | Normalized galvanic skin response |

---

## Message Type 2: `event`

Sent when a discrete security event occurs in Aegis (panic trigger, system armed, vision alert, etc.).

### Shape

```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "event",
  "data": {
    "type": "EMERGENCY_DISPATCH",
    "payload": {
      "location": { "lat": 40.4168, "lng": -3.7038 },
      "threatLevel": "critical",
      "confidence": 0.92
    }
  }
}
```

### Event types (`data.type`)

| Event Type | Trigger | Typical `payload` fields |
|---|---|---|
| `SYSTEM_ARMED` | Operator arms the system | `armedAt`, `operatorName` |
| `SYSTEM_DISARMED` | Operator disarms the system | `disarmedAt`, `operatorName` |
| `USER_INTERACTION` | User interacts with the app | `action`, `target` |
| `KEYWORD_DETECTED` | IA worker detects a keyword | `keyword`, `transcript`, `confidence` |
| `VISION_ALERT` | Camera vision detects a threat | `label`, `bbox`, `score`, `cameraId` |
| `SPEECH_COERCION` | Voice analysis detects coercion | `coercionScore`, `transcript` |
| `EMERGENCY_DISPATCH` | Emergency / panic triggered | `location`, `threatLevel`, `confidence` |
| `GEO_UPDATE` | GPS position update | `lat`, `lng`, `speed`, `heading` |
| `HARDWARE_DIAG` | Hardware diagnostic event | `device`, `status`, `battery` |
| `NETWORK_RTT` | Network latency measurement | `rtt`, `online` |
| `FALLBACK_QUEUED` | Event queued for retry | `reason`, `rtt` |
| `FALLBACK_FLUSHED` | Queued events sent | `count` |
| `CAMERA_PERMISSION_DENIED` | Camera access blocked | `reason` |
| `AUDIO_ALERT` | Audio anomaly detected | `level`, `frequency`, `confidence` |
| `ADVERSARIAL_GARMENT` | Anti-AI clothing detected | `silhouette`, `label` |
| `FACE_DENSITY` | 3+ clustered faces (HyperFace) | `count`, `bbox` |
| `IR_SABOTAGE` | Optical sabotage detected | `sector`, `intensity` |

All event payloads include a `confidence` field (0.0–1.0) computed by Aegis's event confidence engine.

---

## Message Type 3: `heartbeat`

Sent every 5 seconds to keep the connection alive. No action needed in UE5 beyond keeping the socket open.

```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "heartbeat",
  "data": null
}
```

---

## UE5 Listener — C++ Implementation

### Prerequisites

Enable the **WebSocket** plugin in UE5:

1. Edit → Plugins → search "WebSocket" → enable **WebSocket Networking**
2. Edit → Project Settings → Plugins → WebSocket Networking → Server Port = `17771`
3. Restart the editor

### `AegisBridgeReceiver.h`

```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "IWebSocket.h"
#include "WebSocket/IXWebSocketNetConnection.h"
#include "AegisBridgeReceiver.generated.h"

UENUM(BlueprintType)
enum class EAegisConsciousnessState : uint8
{
    Calm        UMETA(DisplayName = "CALM"),
    Alert       UMETA(DisplayName = "ALERT"),
    Stressed    UMETA(DisplayName = "STRESSED"),
    Critical    UMETA(DisplayName = "CRITICAL")
};

USTRUCT(BlueprintType)
struct FAegisCognitiveData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    int32 EnergyLevel = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    int32 VibrationIndex = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    int32 CausalityScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    EAegisConsciousnessState ConsciousnessState = EAegisConsciousnessState::Calm;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    float BPM = 0.f;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    float AudioLevel = 0.f;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    float Motion = 0.f;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    FVector2D GPS = FVector2D::ZeroVector;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    int64 Timestamp = 0;
};

USTRUCT(BlueprintType)
struct FAegisEvent
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    FString EventType;

    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    FString PayloadJSON;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAegisCognitiveUpdate, const FAegisCognitiveData&, Data);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAegisEvent, const FAegisEvent&, Event);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAegisConnected);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAegisDisconnected);

UCLASS()
class AAegisBridgeReceiver : public AActor
{
    GENERATED_BODY()

public:
    AAegisBridgeReceiver();

    // Blueprint-accessible events
    UPROPERTY(BlueprintAssignable, Category = "Aegis")
    FOnAegisCognitiveUpdate OnCognitiveUpdate;

    UPROPERTY(BlueprintAssignable, Category = "Aegis")
    FOnAegisEvent OnEventReceived;

    UPROPERTY(BlueprintAssignable, Category = "Aegis")
    FOnAegisConnected OnConnected;

    UPROPERTY(BlueprintAssignable, Category = "Aegis")
    FOnAegisDisconnected OnDisconnected;

    // Current cached state — readable from any Blueprint
    UPROPERTY(BlueprintReadOnly, Category = "Aegis")
    FAegisCognitiveData CurrentCognitive;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    TSharedPtr<IWebSocket> WebSocket;

    void OnConnectedHandler();
    void OnConnectionErrorHandler(const FString& Error);
    void OnClosedHandler(int32 StatusCode, const FString& Reason);
    void OnMessageHandler(const FString& MessageString);

    void ParseCognitive(const TSharedPtr<FJsonObject>& DataObj);
    void ParseEvent(const TSharedPtr<FJsonObject>& DataObj);

    EAegisConsciousnessState StringToState(const FString& StateStr) const;
};
```

### `AegisBridgeReceiver.cpp`

```cpp
#include "AegisBridgeReceiver.h"
#include "WebSocketsModule.h"
#include "JsonObjectConverter.h"
#include "Serialization/JsonSerializer.h"

AAegisBridgeReceiver::AAegisBridgeReceiver()
{
    PrimaryActorTick.bCanEverTick = false;
}

void AAegisBridgeReceiver::BeginPlay()
{
    Super::BeginPlay();

    if (!FModuleManager::Get().IsModuleLoaded("WebSockets"))
    {
        FModuleManager::Get().LoadModule("WebSockets");
    }

    // UE5 acts as WebSocket SERVER on port 17771 — Aegis connects as client.
    // If using the WebSocket server plugin:
    const FString ServerUrl = TEXT("ws://0.0.0.0:17771");

    WebSocket = FWebSocketsModule::Get().CreateWebSocket(
        TEXT("ws://localhost:17771"),
        TEXT("")
    );

    // Alternatively, use a WebSocket server plugin (e.g., "WebSocketServer")
    // so Aegis (the browser) can connect TO Unreal.

    WebSocket->OnConnected().AddLambda([this]() { OnConnectedHandler(); });
    WebSocket->OnConnectionError().AddLambda(
        [this](const FString& Err) { OnConnectionErrorHandler(Err); });
    WebSocket->OnClosed().AddLambda(
        [this](int32 Code, const FString& Reason) { OnClosedHandler(Code, Reason); });
    WebSocket->OnMessage().AddLambda(
        [this](const FString& Msg) { OnMessageHandler(Msg); });

    WebSocket->Connect();
}

void AAegisBridgeReceiver::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (WebSocket.IsValid())
    {
        WebSocket->Close();
    }
    Super::EndPlay(EndPlayReason);
}

void AAegisBridgeReceiver::OnConnectedHandler()
{
    UE_LOG(LogTemp, Log, TEXT("AegisBridge: WebSocket connected"));
    OnConnected.Broadcast();
}

void AAegisBridgeReceiver::OnConnectionErrorHandler(const FString& Error)
{
    UE_LOG(LogTemp, Warning, TEXT("AegisBridge: Connection error: %s"), *Error);
}

void AAegisBridgeReceiver::OnClosedHandler(int32 StatusCode, const FString& Reason)
{
    UE_LOG(LogTemp, Log, TEXT("AegisBridge: Closed (%d) %s"), StatusCode, *Reason);
    OnDisconnected.Broadcast();
}

void AAegisBridgeReceiver::OnMessageHandler(const FString& MessageString)
{
    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(MessageString);

    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
        return;

    FString MsgType = Root->GetStringField(TEXT("type"));
    const TSharedPtr<FJsonObject>* DataObj;
    if (!Root->TryGetObjectField(TEXT("data"), DataObj))
        return;

    if (MsgType == TEXT("cognitive"))
    {
        ParseCognitive(*DataObj);
    }
    else if (MsgType == TEXT("event"))
    {
        ParseEvent(*DataObj);
    }
    // heartbeat — ignore
}

void AAegisBridgeReceiver::ParseCognitive(const TSharedPtr<FJsonObject>& DataObj)
{
    FAegisCognitiveData Data;

    Data.EnergyLevel       = DataObj->GetIntegerField(TEXT("energyLevel"));
    Data.VibrationIndex    = DataObj->GetIntegerField(TEXT("vibrationIndex"));
    Data.CausalityScore    = DataObj->GetIntegerField(TEXT("causalityScore"));
    Data.ConsciousnessState = StringToState(
        DataObj->GetStringField(TEXT("consciousnessState")));

    const TSharedPtr<FJsonObject>* RawObj;
    if (DataObj->TryGetObjectField(TEXT("raw"), RawObj) && RawObj->IsValid())
    {
        Data.BPM       = static_cast<float>((*RawObj)->GetNumberField(TEXT("bpm")));
        Data.AudioLevel = static_cast<float>((*RawObj)->GetNumberField(TEXT("audioLevel")));
        Data.Motion    = static_cast<float>((*RawObj)->GetNumberField(TEXT("motion")));

        double Lat = 0.0, Lng = 0.0;
        (*RawObj)->TryGetNumberField(TEXT("latitude"), Lat);
        (*RawObj)->TryGetNumberField(TEXT("longitude"), Lng);
        Data.GPS = FVector2D(Lat, Lng);
    }

    Data.Timestamp = static_cast<int64>(DataObj->GetNumberField(TEXT("timestamp")));

    CurrentCognitive = Data;
    OnCognitiveUpdate.Broadcast(Data);
}

void AAegisBridgeReceiver::ParseEvent(const TSharedPtr<FJsonObject>& DataObj)
{
    FAegisEvent Event;
    Event.EventType = DataObj->GetStringField(TEXT("type"));

    const TSharedPtr<FJsonObject>* PayloadObj;
    if (DataObj->TryGetObjectField(TEXT("payload"), PayloadObj) && PayloadObj->IsValid())
    {
        TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Event.PayloadJSON);
        FJsonSerializer::Serialize(*PayloadObj, Writer);
    }

    UE_LOG(LogTemp, Log, TEXT("AegisBridge: Event %s"), *Event.EventType);
    OnEventReceived.Broadcast(Event);
}

EAegisConsciousnessState AAegisBridgeReceiver::StringToState(const FString& StateStr) const
{
    if (StateStr == TEXT("ALERT"))    return EAegisConsciousnessState::Alert;
    if (StateStr == TEXT("STRESSED")) return EAegisConsciousnessState::Stressed;
    if (StateStr == TEXT("CRITICAL")) return EAegisConsciousnessState::Critical;
    return EAegisConsciousnessState::Calm;
}
```

---

## UE5 Listener — Blueprint Integration

Once the C++ actor is placed in the level:

1. **Drag `AegisBridgeReceiver` into the level** (or spawn it in `GameMode`).
2. **In the Level Blueprint** (or any Actor Blueprint), bind to the events:

```
Event BeginPlay
  → Get All Actors of Class (AegisBridgeReceiver)
  → For Each → Bind Event to OnCognitiveUpdate
             → Bind Event to OnEventReceived
```

3. **Example: Change weather based on consciousness state**

```
Custom Event: Handle Cognitive Update (Data: FAegisCognitiveData)
  Switch on Data.ConsciousnessState
    → CALM:      Set Weather (Sunny, 0.2 cloud cover)
    → ALERT:     Set Weather (Cloudy, 0.5 cloud cover)
    → STRESSED:  Set Weather (Stormy, 0.8 cloud cover, rain)
    → CRITICAL:  Set Weather (Heavy Storm, 1.0, thunder + fog)
```

4. **Example: Spawn NPC on EMERGENCY_DISPATCH**

```
Custom Event: Handle Aegis Event (Event: FAegisEvent)
  Switch on Event.EventType
    → "EMERGENCY_DISPATCH":
        Spawn Actor (Hostile NPC) at Player Location + Offset
        Play Sound (Alert SFX)
    → "SYSTEM_ARMED":
        Enable NPC Patrol Logic
        Set Ambient Music (Tension Track)
    → "SYSTEM_DISARMED":
        Disable NPC Patrol Logic
        Set Ambient Music (Calm Track)
    → "VISION_ALERT":
        Highlight Detected Area (Decal + Particle)
```

5. **Example: Drive faction relations from energy level**

```
Custom Event: Handle Cognitive Update (Data: FAegisCognitiveData)
  → Set Faction Hostility = Data.EnergyLevel / 100
  → Set NPC Aggression Radius = 500 + (Data.EnergyLevel * 10)
  → Set Lighting Intensity = 1.0 - (Data.VibrationIndex / 200)
```

---

## Architecture Notes

### STARProcessor cognitive layers

The `cognitive` message is the output of STARProcessor's three-layer analysis:

1. **Energy** (`energyLevel`): Weighted blend of BPM (45%), audio (25%), and motion (30%). Each input is normalized to 0–100. Represents total physiological activation.

2. **Vibration** (`vibrationIndex`): Measures how rapidly `energyLevel` has changed over the last 5 readings. High vibration = volatile, unstable state. Low vibration = steady state.

3. **Causality** (`causalityScore`): Measures how coherent the sensor readings are with each other. High causality = all sensors tell the same story (e.g. high BPM + high motion + high audio → genuinely stressed). Low causality = contradictory signals (possibly sensor noise or spoofing).

### SynerisMemory (memoria viva)

SynerisMemory stores enriched events in IndexedDB and detects patterns:
- Recurring event types (same event repeated N+ times)
- Nighttime activity clusters (22:00–06:00)
- Panic/critical event clusters
- Weekday concentration

The memory report is available internally to Aegis and can be streamed to UE5 as an `event` message type if the game needs long-term behavioral context.

### Offline resilience

GameBridge is designed to **never crash Aegis**:
- If the WebSocket fails to connect, Aegis continues in offline mode
- Auto-reconnect attempts every 3 seconds
- All cognitive and event processing continues locally regardless of bridge status
- The operator sees real-time connection status in Settings (green/yellow/red indicator)

---

## Quick Reference: JSON Schemas

### Cognitive message
```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "cognitive",
  "data": {
    "energyLevel": 0,
    "vibrationIndex": 0,
    "causalityScore": 0,
    "consciousnessState": "CALM|ALERT|STRESSED|CRITICAL",
    "raw": {
      "bpm": 0,
      "audioLevel": 0.0,
      "latitude": 0.0,
      "longitude": 0.0,
      "motion": 0.0,
      "respiration": 0,
      "skinConductance": 0.0
    },
    "timestamp": 0
  }
}
```

### Event message
```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "event",
  "data": {
    "type": "EVENT_TYPE",
    "payload": { "confidence": 0.0 }
  }
}
```

### Heartbeat message
```json
{
  "source": "AEGIS",
  "timestamp": 1722710000000,
  "type": "heartbeat",
  "data": null
}
```

---

## File Reference

| File | Role |
|---|---|
| `src/services/GameBridgeService.ts` | WebSocket client — connects to UE5, sends messages |
| `src/services/STARProcessor.ts` | Cognitive processor — 3-layer analysis of sensor data |
| `src/services/SynerisMemoryService.ts` | Memory engine — IndexedDB storage + pattern detection |
| `src/core/EVOLIS.ts` | Integration hub — connects mesh events to memory + cognitive processing |
| `src/pages/Settings.tsx` | UI toggle for the UE5 bridge |

## Demo URL

**https://matylipsa-create-sen-de6m.bolt.host**

Toggle the bridge in Settings → Puente UE5 — GameBridge.
