"use client";

import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { Flower2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";

const stars = [[7,14,2],[13,35,1],[20,8,1],[27,25,2],[34,13,1],[43,31,1],[51,10,2],[59,22,1],[67,7,1],[74,33,2],[82,16,1],[90,28,1],[95,9,2],[17,52,1],[69,48,1]];
const flowers = [
  { id: "golden", name: "ทองอร่าม", value: "#e5a934", filter: "hue-rotate(0deg)" },
  { id: "lotus-pink", name: "ชมพูบัว", value: "#d76d92", filter: "hue-rotate(325deg) saturate(1.15)" },
  { id: "orchid", name: "ม่วงพฤกษา", value: "#8f74bd", filter: "hue-rotate(250deg) saturate(1.15)" },
  { id: "river-blue", name: "ฟ้านที", value: "#4d9eb7", filter: "hue-rotate(160deg) saturate(.9)" },
] as const;

type FlowerId = (typeof flowers)[number]["id"];
type Krathong = { id: string; flower: FlowerId; wish: string };
const getFlower = (id: string) => flowers.find((flower) => flower.id === id) ?? flowers[0];

function KrathongVisual({ flower, className = "" }: { flower: string; className?: string }) {
  const selectedFlower = getFlower(flower);
  return <Image className={`generated-krathong ${className}`} src="/images/krathong-lotus.png" alt={`กระทง${selectedFlower.name}`} width={120} height={120} style={{ filter: selectedFlower.filter }} />;
}

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flower, setFlower] = useState<FlowerId>(flowers[0].id);
  const [wish, setWish] = useState("");
  const [krathongs, setKrathongs] = useState<Krathong[]>([]);
  const [isFloating, setIsFloating] = useState(false);
  const [firebaseError, setFirebaseError] = useState(false);

  useEffect(() => {
    const riverQuery = query(collection(db, "krathongs"), orderBy("createdAt", "desc"));
    return onSnapshot(riverQuery, (snapshot) => {
      setKrathongs(snapshot.docs.map((document) => {
        const data = document.data();
        return { id: document.id, flower: data.flower as FlowerId, wish: typeof data.wish === "string" ? data.wish : "" };
      }));
      setFirebaseError(false);
    }, () => setFirebaseError(true));
  }, []);

  async function floatKrathong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsFloating(true);
    try {
      await addDoc(collection(db, "krathongs"), { flower, wish: wish.trim(), createdAt: serverTimestamp() });
      setWish("");
      setIsModalOpen(false);
    } catch {
      setFirebaseError(true);
    } finally { setIsFloating(false); }
  }

  return <main className="night-scene">
    <div className="stars" aria-hidden="true">{stars.map(([left, top, size], index) => <i className="star" key={index} style={{ left: `${left}%`, top: `${top}%`, width: `${size * 3}px`, height: `${size * 3}px`, animationDelay: `${index * -0.45}s` }} />)}</div>
    <div className="moon" aria-label="พระจันทร์เต็มดวง"><span className="moon-mark mark-one" /><span className="moon-mark mark-two" /><span className="moon-mark mark-three" /></div>
    <div className="distant-hills hill-back" aria-hidden="true" /><div className="distant-hills hill-front" aria-hidden="true" />
    <section className="hero"><p className="eyebrow"><Sparkles size={15} /> คืนวันเพ็ญ</p><h1>ลอยกระทง<br /><em>ใต้แสงจันทร์</em></h1><p className="intro">ร่วมส่งคำอธิษฐานไปกับสายน้ำ<br />ในค่ำคืนที่งดงามที่สุดของปี</p><button className="create-button" onClick={() => setIsModalOpen(true)}><Flower2 size={21} strokeWidth={1.8} />สร้างกระทงของฉัน</button></section>
    <section className="river" aria-label="แม่น้ำสำหรับลอยกระทง"><div className="moon-reflection" aria-hidden="true" /><div className="river-glow glow-one" aria-hidden="true" /><div className="river-glow glow-two" aria-hidden="true" /><div className="wave wave-one" aria-hidden="true" /><div className="wave wave-two" aria-hidden="true" /><div className="wave wave-three" aria-hidden="true" />
      {krathongs.map((krathong, index) => <div className="krathong-position" key={krathong.id} style={{ left: `${12 + ((index * 23) % 72)}%`, top: `${22 + ((index * 17) % 48)}%`, animationDelay: `${index * -1.2}s` }}><KrathongVisual flower={krathong.flower} /><span className="wish-tooltip">{krathong.wish || "ขอให้มีความสุขในคืนวันเพ็ญ"}</span></div>)}
      {krathongs.length === 0 && <div className="empty-river-message"><span>✦</span><p>แม่น้ำกำลังรอคำอธิษฐานของคุณ</p></div>}
      {firebaseError && <p className="firebase-notice">ยังเชื่อมต่อแม่น้ำรวมไม่ได้ — ตรวจสอบ Firestore และ rules</p>}
    </section><p className="scroll-hint">เลื่อนลงเพื่อเริ่มลอยกระทง <span>↓</span></p>
    {isModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsModalOpen(false)}><section className="krathong-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" aria-label="ปิด" onClick={() => setIsModalOpen(false)}><X size={20} /></button><p className="modal-kicker">คืนวันเพ็ญ</p><h2 id="modal-title">สร้างกระทงของคุณ</h2><div className="preview-card"><KrathongVisual flower={flower} className="preview-krathong" /><p>ตัวอย่างกระทงของคุณ</p></div><form onSubmit={floatKrathong}><fieldset><legend>เลือกแบบและสีดอกไม้</legend><div className="color-options">{flowers.map((option) => <button type="button" className={`color-option ${flower === option.id ? "selected" : ""}`} key={option.id} onClick={() => setFlower(option.id)} aria-pressed={flower === option.id}><Image src="/images/krathong-lotus.png" alt="" width={64} height={64} style={{ filter: option.filter }} /><span className="color-name"><i style={{ backgroundColor: option.value }} />{option.name}</span></button>)}</div></fieldset><label htmlFor="wish">คำอวยพร <span>ไม่บังคับ</span></label><textarea id="wish" value={wish} onChange={(event) => setWish(event.target.value)} maxLength={80} placeholder="ขอให้สิ่งดี ๆ ลอยเข้ามาในชีวิต…" /><button className="float-button" type="submit" disabled={isFloating}><Sparkles size={18} />{isFloating ? "กำลังลอย…" : "ลอยกระทง"}</button></form></section></div>}
  </main>;
}
