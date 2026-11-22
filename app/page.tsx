
"use client";

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import {
  Flower2,
  Sparkles,
  X,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

import Image from "next/image";

import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { db } from "@/lib/firebase";

// ==========================================
// TYPES
// ==========================================

type FlowerType =
  | "lotus"
  | "marigold"
  | "rose"
  | "jasmine"
  | "orchid";

type FlowerColor =
  | "pink"
  | "yellow"
  | "purple"
  | "white";

type CandleColor =
  | "yellow"
  | "pink"
  | "white"
  | "purple";

type BaseType =
  | "banana-leaf"
  | "lotus-base"
  | "bread"
  | "coconut";

type FlowerPosition = {
  x: number;
  y: number;
};

type Krathong = {
  id: string;
  flowerType: FlowerType;
  flowerColor: FlowerColor;
  flowerCount: number;
  flowerPositions: FlowerPosition[];
  baseType: BaseType;
  incenseCount: number;
  candleCount: number;
  candleColor: CandleColor;
  wish: string;
};

type KrathongPosition = {
  x: number;
  y: number;
};

type DragInfo = {
  id: string;
  pointerId: number;
  riverRect: DOMRect;
};

// ==========================================
// OPTIONS
// ==========================================

const stars = [
  [7, 14, 2],
  [13, 35, 1],
  [20, 8, 1],
  [27, 25, 2],
  [34, 13, 1],
  [43, 31, 1],
  [51, 10, 2],
  [59, 22, 1],
  [67, 7, 1],
  [74, 33, 2],
  [82, 16, 1],
  [90, 28, 1],
  [95, 9, 2],
  [17, 52, 1],
  [69, 48, 1],
];

const flowerOptions = [
  { id: "lotus", name: "ดอกบัว", image: "lotus.png" },
  { id: "marigold", name: "ดาวเรือง", image: "marigold.png" },
  { id: "rose", name: "กุหลาบ", image: "rose.png" },
  { id: "jasmine", name: "มะลิ", image: "jasmine.png" },
  { id: "orchid", name: "กล้วยไม้", image: "orchid.png" },
] as const;

const colorOptions = [
  { id: "pink", name: "ชมพู", value: "#df8da9" },
  { id: "yellow", name: "เหลือง", value: "#e8bd4b" },
  { id: "purple", name: "ม่วง", value: "#a88acb" },
  { id: "white", name: "ขาว", value: "#f4eee0" },
] as const;

const baseOptions = [
  {
    id: "banana-leaf",
    name: "ฐานใบตอง",
    image: "banana-leaf.png",
  },
  {
    id: "lotus-base",
    name: "ฐานดอกบัว",
    image: "lotus-base.png",
  },
  {
    id: "bread",
    name: "ฐานขนมปัง",
    image: "bread.png",
  },
  {
    id: "coconut",
    name: "ฐานกะลา",
    image: "coconut.png",
  },
] as const;

const flowerFilters: Record<FlowerColor, string> = {
  pink: "hue-rotate(325deg) saturate(1.2)",
  yellow: "hue-rotate(35deg) saturate(1.3)",
  purple: "hue-rotate(250deg) saturate(1.15)",
  white: "grayscale(0.65) brightness(1.3)",
};

const flowerImage = (type: FlowerType) =>
  `/images/krathong/flowers/${flowerOptions.find((item) => item.id === type)?.image
  }`;

const baseImage = (type: BaseType) =>
  `/images/krathong/bases/${baseOptions.find((item) => item.id === type)?.image
  }`;

// ==========================================
// DEFAULT FLOWER POSITIONS
// ==========================================

const normalFlowerPositions: FlowerPosition[] = [
  { x: 50, y: 48 },
  { x: 38, y: 52 },
  { x: 62, y: 52 },
  { x: 43, y: 59 },
  { x: 57, y: 59 },
  { x: 50, y: 64 },
  { x: 33, y: 59 },
  { x: 67, y: 59 },
  { x: 50, y: 55 },
];

const coconutFlowerPositions: FlowerPosition[] = [
  { x: 50, y: 45 },
  { x: 38, y: 49 },
  { x: 62, y: 49 },
  { x: 44, y: 55 },
  { x: 56, y: 55 },
  { x: 50, y: 58 },
  { x: 32, y: 51 },
  { x: 68, y: 51 },
  { x: 50, y: 51 },
];

function getDefaultFlowerPositions(
  baseType: BaseType
): FlowerPosition[] {
  const positions =
    baseType === "coconut"
      ? coconutFlowerPositions
      : normalFlowerPositions;

  return positions.map((position) => ({ ...position }));
}

// ==========================================
// FIRESTORE VALIDATION
// ==========================================

function normalizeFlowerPositions(
  value: unknown,
  baseType: BaseType
): FlowerPosition[] {
  const defaults = getDefaultFlowerPositions(baseType);

  if (!Array.isArray(value)) {
    return defaults;
  }

  return defaults.map((fallback, index) => {
    const position = value[index];

    if (
      !position ||
      typeof position.x !== "number" ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return fallback;
    }

    return {
      x: Math.max(5, Math.min(95, position.x)),
      y: Math.max(10, Math.min(85, position.y)),
    };
  });
}

function isOption<T extends string>(
  value: unknown,
  options: readonly { id: T }[],
  fallback: T
): T {
  return options.some((option) => option.id === value)
    ? (value as T)
    : fallback;
}

function safeCount(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(min, Math.min(max, Math.floor(number)));
}

// ==========================================
// KRATHONG VISUAL PROPS
// ==========================================

type KrathongVisualProps = {
  krathong: Pick<
    Krathong,
    | "flowerType"
    | "flowerColor"
    | "flowerCount"
    | "baseType"
    | "incenseCount"
    | "candleCount"
    | "candleColor"
  >;

  preview?: boolean;

  flowerPositions?: FlowerPosition[];

  onFlowerMove?: (
    index: number,
    x: number,
    y: number
  ) => void;
};

// ==========================================
// KRATHONG VISUAL
// ==========================================

function KrathongVisual({
  krathong,
  preview = false,
  flowerPositions,
  onFlowerMove,
}: KrathongVisualProps) {
  const defaultPositions = getDefaultFlowerPositions(
    krathong.baseType
  );

  // ========================================
  // FLOWER DRAG
  // ========================================

  const handleFlowerPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!preview || !onFlowerMove) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  };

  const handleFlowerPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    index: number
  ) => {
    if (!preview || !onFlowerMove) return;

    if (
      !event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      return;
    }

    const art = event.currentTarget.parentElement;

    if (!art) return;

    const rect = art.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x =
      ((event.clientX - rect.left) / rect.width) * 100;

    const y =
      ((event.clientY - rect.top) / rect.height) * 100;

    onFlowerMove(
      index,
      Math.max(5, Math.min(95, x)),
      Math.max(10, Math.min(85, y))
    );
  };

  const handleFlowerPointerEnd = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  };

  return (
    <div
      className={`krathong-art ${preview ? "is-preview" : ""
        }`}
    >
      {/* BASE */}

      <Image
        src={baseImage(krathong.baseType)}
        alt="ฐานกระทง"
        fill
        sizes="180px"
        className="krathong-layer base-layer"
        draggable={false}
      />

      {/* FLOWERS */}

      {Array.from({
        length: krathong.flowerCount,
      }).map((_, index) => {
        const position =
          flowerPositions?.[index] ??
          defaultPositions[index];

        return (
          <div
            key={index}
            className={`flower-layer ${preview ? "flower-draggable" : ""
              }`}
            onPointerDown={handleFlowerPointerDown}
            onPointerMove={(event) =>
              handleFlowerPointerMove(event, index)
            }
            onPointerUp={handleFlowerPointerEnd}
            onPointerCancel={handleFlowerPointerEnd}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width:
                krathong.baseType === "coconut"
                  ? "16%"
                  : "19%",
              zIndex: index + 2,
              touchAction: preview ? "none" : "auto",
              cursor: preview ? "grab" : "default",
            }}
          >
            <Image
              src={flowerImage(krathong.flowerType)}
              alt={`ดอกไม้ดอกที่ ${index + 1}`}
              fill
              sizes="70px"
              className="krathong-layer"
              style={{
                filter: flowerFilters[krathong.flowerColor],
                pointerEvents: "none",
              }}
              draggable={false}
            />
          </div>
        );
      })}

      {/* INCENSE */}

      {krathong.incenseCount > 0 && (
        <div
          className="incense-layer"
          style={
            krathong.baseType === "coconut"
              ? {
                left: "42%",
                top: "30%",
                width: "22%",
                height: "40%",
              }
              : undefined
          }
        >
          <Image
            src={`/images/krathong/accessories/incense-${krathong.incenseCount}.png`}
            alt={`ธูป ${krathong.incenseCount} ดอก`}
            fill
            sizes="30px"
            draggable={false}
          />
        </div>
      )}

      {/* CANDLE */}

      {krathong.candleCount > 0 && (
        <div
          className="candle-layer"
          style={
            krathong.baseType === "coconut"
              ? {
                left: "57%",
                top: "29%",
                width: "19%",
                height: "40%",
              }
              : undefined
          }
        >
          <Image
            src={`/images/krathong/accessories/candle-${krathong.candleColor}.png`}
            alt={`เทียนสี${krathong.candleColor}`}
            fill
            sizes="35px"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN PAGE
// ==========================================

export default function Home() {
  // ========================================
  // MODAL
  // ========================================

  const [isModalOpen, setIsModalOpen] = useState(false);

  // ========================================
  // FLOWER SETTINGS
  // ========================================

  const [flowerType, setFlowerType] =
    useState<FlowerType>("lotus");

  const [flowerColor, setFlowerColor] =
    useState<FlowerColor>("pink");

  const [flowerCount, setFlowerCount] = useState(3);

  const [flowerPositions, setFlowerPositions] =
    useState<FlowerPosition[]>(() =>
      getDefaultFlowerPositions("banana-leaf")
    );

  // ========================================
  // BASE SETTINGS
  // ========================================

  const [baseType, setBaseType] =
    useState<BaseType>("banana-leaf");

  // ========================================
  // INCENSE SETTINGS
  // ========================================

  const [incenseCount, setIncenseCount] = useState(3);

  // ========================================
  // CANDLE SETTINGS
  // ========================================

  const [candleCount, setCandleCount] = useState(1);

  const [candleColor, setCandleColor] =
    useState<CandleColor>("yellow");

  // ========================================
  // WISH
  // ========================================

  const [wish, setWish] = useState("");

  // ========================================
  // FIREBASE
  // ========================================

  const [krathongs, setKrathongs] = useState<Krathong[]>([]);

  const [isFloating, setIsFloating] = useState(false);

  const [firebaseError, setFirebaseError] = useState(false);

  // ========================================
  // RIVER DRAG
  // ========================================

  const [positions, setPositions] = useState<
    Record<string, KrathongPosition>
  >({});

  const [draggingId, setDraggingId] =
    useState<string | null>(null);

  const riverRef = useRef<HTMLElement>(null);

  const dragRef = useRef<DragInfo | null>(null);

  // ========================================
  // MODAL SCROLL LOCK
  // ========================================

  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow =
      document.body.style.overflow;

    const originalTouchAction =
      document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction =
        originalTouchAction;
    };
  }, [isModalOpen]);

  // ========================================
  // FIREBASE REALTIME
  // ========================================

  useEffect(() => {
    const riverQuery = query(
      collection(db, "krathongs"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      riverQuery,
      (snapshot) => {
        const result: Krathong[] =
          snapshot.docs.map((document) => {
            const data = document.data();

            const savedBaseType = isOption(
              data.baseType,
              baseOptions,
              "banana-leaf"
            );

            return {
              id: document.id,

              flowerType: isOption(
                data.flowerType,
                flowerOptions,
                "lotus"
              ),

              flowerColor: isOption(
                data.flowerColor,
                colorOptions,
                "pink"
              ),

              flowerCount: safeCount(
                data.flowerCount,
                3,
                1,
                9
              ),

              flowerPositions: normalizeFlowerPositions(
                data.flowerPositions,
                savedBaseType
              ),

              baseType: savedBaseType,

              incenseCount: safeCount(
                data.incenseCount,
                3,
                0,
                3
              ),

              candleCount: safeCount(
                data.candleCount,
                1,
                0,
                1
              ),

              candleColor: isOption(
                data.candleColor,
                colorOptions,
                "yellow"
              ),

              wish:
                typeof data.wish === "string"
                  ? data.wish
                  : "",
            };
          });

        setKrathongs(result);
        setFirebaseError(false);
      },

      (error) => {
        console.error("Firebase snapshot error:", error);
        setFirebaseError(true);
      }
    );
  }, []);

  // ========================================
  // CHANGE BASE
  // ========================================

  const handleBaseChange = (newBase: BaseType) => {
    setBaseType(newBase);

    setFlowerPositions(
      getDefaultFlowerPositions(newBase)
    );
  };

  // ========================================
  // MOVE FLOWER
  // ========================================

  const handleFlowerMove = (
    index: number,
    x: number,
    y: number
  ) => {
    setFlowerPositions((previous) =>
      previous.map((position, i) =>
        i === index ? { x, y } : position
      )
    );
  };

  // ========================================
  // RESET FLOWERS
  // ========================================

  const resetFlowerPositions = () => {
    setFlowerPositions(
      getDefaultFlowerPositions(baseType)
    );
  };

  // ========================================
  // FLOAT KRATHONG - SAVE FIREBASE
  // ========================================

  async function floatKrathong(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isFloating) return;

    setIsFloating(true);

    try {
      // บันทึกข้อมูลตกแต่งทั้งหมด

      await addDoc(collection(db, "krathongs"), {
        flowerType,
        flowerColor,
        flowerCount,
        flowerPositions: flowerPositions.map((position) => ({
          x: position.x,
          y: position.y,
        })),
        baseType,
        incenseCount,
        candleCount,
        candleColor,
        wish: wish.trim(),
        createdAt: serverTimestamp(),
      });

      setWish("");
      setIsModalOpen(false);

      setFlowerPositions(
        getDefaultFlowerPositions(baseType)
      );
    } catch (error) {
      console.error("Firebase error:", error);
      setFirebaseError(true);
    } finally {
      setIsFloating(false);
    }
  }

  // ========================================
  // RIVER POSITION
  // ========================================

  const getPosition = (
    id: string,
    index: number
  ): KrathongPosition =>
    positions[id] ?? {
      x: 12 + ((index * 23) % 72),
      y: 22 + ((index * 17) % 48),
    };

  // ========================================
  // RIVER DRAG START
  // ========================================

  const handleDragStart = (
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) => {
    if (!riverRef.current) return;

    event.preventDefault();

    const riverRect =
      riverRef.current.getBoundingClientRect();

    dragRef.current = {
      id,
      pointerId: event.pointerId,
      riverRect,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    setDraggingId(id);
  };

  // ========================================
  // RIVER DRAG MOVE
  // ========================================

  const handleDragMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    const x =
      ((event.clientX - drag.riverRect.left) /
        drag.riverRect.width) *
      100;

    const y =
      ((event.clientY - drag.riverRect.top) /
        drag.riverRect.height) *
      100;

    setPositions((previous) => ({
      ...previous,
      [drag.id]: {
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(12, Math.min(88, y)),
      },
    }));
  };

  // ========================================
  // RIVER DRAG END
  // ========================================

  const handleDragEnd = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      dragRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }

    dragRef.current = null;
    setDraggingId(null);

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  };

  // ========================================
  // PREVIEW DATA
  // ========================================

  const previewKrathong = {
    flowerType,
    flowerColor,
    flowerCount,
    baseType,
    incenseCount,
    candleCount,
    candleColor,
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <main className="night-scene">

      {/* STARS */}

      <div className="stars" aria-hidden="true">
        {stars.map(([left, top, size], index) => (
          <i
            className="star"
            key={index}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size * 3}px`,
              height: `${size * 3}px`,
              animationDelay: `${index * -0.45}s`,
            }}
          />
        ))}
      </div>

      <div className="palace-background" aria-hidden="true" />

      {/* HERO */}

      <section className="hero">
        <p className="eyebrow">
          <Sparkles size={15} /> คืนวันเพ็ญเดือน 12 น้ำคะนองเต็มตลิ่ง
        </p>

        <h1>
          สวัสดีวันลอยกระทง
          <br />
          <em>ร่วมลอยละลอย</em>
        </h1>

        <p className="intro">
          ร่วมส่งคำอธิษฐานไปกับสายน้ำ
          <br />
          ในค่ำคืนที่งดงามที่สุดของปี วันที่ดวงจันทร์เต็มฟ้าฉันืจินตนาการเป็นหน้าเธอ
          เลื่อนกระทงได้เลย
        </p>

        <button
          className="create-button"
          onClick={() => setIsModalOpen(true)}
        >
          <Flower2 size={21} />
          สร้างกระทงของเทออ
        </button>
      </section>

      {/* RIVER */}

      <section
        className="river"
        aria-label="แม่น้ำสำหรับลอยกระทง"
        ref={riverRef}
      >
        <div className="moon-reflection" aria-hidden="true" />
        <div className="river-glow glow-one" aria-hidden="true" />
        <div className="river-glow glow-two" aria-hidden="true" />

        <div className="wave wave-one" aria-hidden="true" />
        <div className="wave wave-two" aria-hidden="true" />
        <div className="wave wave-three" aria-hidden="true" />

        {/* KRATHONG LIST */}

        {krathongs.map((krathong, index) => {
          const position = getPosition(
            krathong.id,
            index
          );

          const depthClass =
            index % 3 === 0
              ? "depth-near"
              : index % 3 === 1
                ? "depth-middle"
                : "depth-far";

          const isDragging =
            draggingId === krathong.id;

          return (
            <div
              key={krathong.id}
              className={`krathong-position ${isDragging ? "is-dragging" : ""
                }`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                zIndex: isDragging ? 20 : index + 3,
              }}
              onPointerDown={(event) =>
                handleDragStart(event, krathong.id)
              }
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className={`krathong-drift ${depthClass}`}>
                <KrathongVisual
                  krathong={krathong}
                  flowerPositions={krathong.flowerPositions}
                />
              </div>

              <span className="wish-tooltip">
                {krathong.wish ||
                  "ขอให้มีความสุขในคืนวันเพ็ญ"}
              </span>
            </div>
          );
        })}

        {/* EMPTY MESSAGE */}

        {krathongs.length === 0 && (
          <div className="empty-river-message">
            <span>✦</span>
            <p>แม่น้ำกำลังรอคำอธิษฐานของเทออ</p>
          </div>
        )}

        {/* FIREBASE ERROR */}

        {firebaseError && (
          <p className="firebase-notice">
            ยังเชื่อมต่อแม่น้ำรวมไม่ได้ — ตรวจสอบ Firestore และ rules
          </p>
        )}
      </section>

      <p className="scroll-hint">
        เลื่อนลงเพื่อเริ่มลอยกระทง <span>↓</span>
      </p>

      {/* ====================================
          CUSTOMIZATION MODAL
      ==================================== */}

      {isModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <section
            className="krathong-modal customize-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="close-button"
              aria-label="ปิด"
              onClick={() => setIsModalOpen(false)}
            >
              <X size={20} />
            </button>

            <p className="modal-kicker">คืนวันเพ็ญเดือนฉิบฉองน้ำตะนอง</p>

            <h2 id="modal-title" className="modal-title">
              ออกแบบกระทงของเทอคั้บ
            </h2>

            {/* LIVE PREVIEW */}

            <div className="custom-preview">
              <KrathongVisual
                krathong={previewKrathong}
                preview
                flowerPositions={flowerPositions}
                onFlowerMove={handleFlowerMove}
              />

              <p>ตัวอย่างกระทงของเทออ</p>

              <span className="drag-flower-hint">
                ✦ ลากดอกไม้เพื่อจัดตำแหน่งได้อย่างอิสระ
              </span>

              <button
                type="button"
                className="reset-flowers-button"
                onClick={resetFlowerPositions}
              >
                <RotateCcw size={14} />
                คืนตำแหน่งดอกไม้
              </button>
            </div>

            <form onSubmit={floatKrathong}>

              {/* 1. FLOWER TYPE */}

              <fieldset>
                <legend>1. เลือกชนิดดอกไม้</legend>

                <div className="custom-options">
                  {flowerOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`custom-option ${flowerType === option.id ? "selected" : ""
                        }`}
                      onClick={() =>
                        setFlowerType(option.id)
                      }
                      aria-pressed={flowerType === option.id}
                    >
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 2. FLOWER COLOR */}

              <fieldset>
                <legend>2. เลือกสีดอกไม้</legend>

                <div className="color-options">
                  {colorOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`color-option ${flowerColor === option.id ? "selected" : ""
                        }`}
                      onClick={() =>
                        setFlowerColor(option.id)
                      }
                      aria-pressed={flowerColor === option.id}
                    >
                      <i
                        className="color-dot"
                        style={{ background: option.value }}
                      />
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 3. BASE */}

              <fieldset>
                <legend>3. เลือกฐานกระทง</legend>

                <div className="custom-options">
                  {baseOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`custom-option ${baseType === option.id ? "selected" : ""
                        }`}
                      onClick={() =>
                        handleBaseChange(option.id)
                      }
                      aria-pressed={baseType === option.id}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 4. FLOWER COUNT */}

              <fieldset>
                <legend>4. จำนวนดอกไม้</legend>

                <div className="count-control">
                  <button
                    type="button"
                    onClick={() =>
                      setFlowerCount((count) =>
                        Math.max(1, count - 1)
                      )
                    }
                    disabled={flowerCount <= 1}
                    aria-label="ลดจำนวนดอกไม้"
                  >
                    <Minus size={16} />
                  </button>

                  <strong>{flowerCount} ดอก</strong>

                  <button
                    type="button"
                    onClick={() =>
                      setFlowerCount((count) =>
                        Math.min(9, count + 1)
                      )
                    }
                    disabled={flowerCount >= 9}
                    aria-label="เพิ่มจำนวนดอกไม้"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </fieldset>

              {/* 5. INCENSE */}

              <fieldset>
                <legend>5. จำนวนธูป</legend>

                <div className="custom-options">
                  {[0, 1, 2, 3].map((count) => (
                    <button
                      type="button"
                      key={count}
                      className={`custom-option ${incenseCount === count ? "selected" : ""
                        }`}
                      onClick={() => setIncenseCount(count)}
                      aria-pressed={incenseCount === count}
                    >
                      {count === 0 ? "ไม่ใส่" : `${count} ดอก`}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 6. CANDLE COUNT */}

              <fieldset>
                <legend>6. เทียน</legend>

                <div className="custom-options">
                  <button
                    type="button"
                    className={`custom-option ${candleCount === 0 ? "selected" : ""
                      }`}
                    onClick={() => setCandleCount(0)}
                    aria-pressed={candleCount === 0}
                  >
                    ไม่ใส่เทียน
                  </button>

                  <button
                    type="button"
                    className={`custom-option ${candleCount === 1 ? "selected" : ""
                      }`}
                    onClick={() => setCandleCount(1)}
                    aria-pressed={candleCount === 1}
                  >
                    เทียน 1 เล่ม
                  </button>
                </div>
              </fieldset>

              {/* 7. CANDLE COLOR */}

              {candleCount > 0 && (
                <fieldset>
                  <legend>7. เลือกสีเทียน</legend>

                  <div className="color-options">
                    {colorOptions.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        className={`color-option ${candleColor === option.id ? "selected" : ""
                          }`}
                        onClick={() =>
                          setCandleColor(option.id)
                        }
                        aria-pressed={candleColor === option.id}
                      >
                        <i
                          className="color-dot"
                          style={{ background: option.value }}
                        />
                        <span>{option.name}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* 8. WISH */}

              <label htmlFor="wish">
                คำอธิษฐาน <span>ไม่บังคับ</span>
              </label>

              <textarea
                id="wish"
                value={wish}
                onChange={(event) =>
                  setWish(event.target.value)
                }
                maxLength={80}
                placeholder="ขอให้สิ่งดี ๆ ลอยเข้ามาในชีวิต…"
              />

              {/* SUBMIT */}

              <button
                className="float-button"
                type="submit"
                disabled={isFloating}
              >
                <Sparkles size={18} />
                {isFloating ? "กำลังลอย…" : "ลอยกระทง"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
