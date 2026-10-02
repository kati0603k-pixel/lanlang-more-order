'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function GenerateQrPage() {
  // ฟอร์ม
  const [tableNumber, setTableNumber] = useState('');
  const [adultCount, setAdultCount] = useState('1');
  const [childCount, setChildCount] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // โต๊ะที่มี session เปิดค้าง + กล่องยืนยัน
  const [existing, setExisting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(0);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  // ผลลัพธ์ QR
  const [result, setResult] = useState(null); // { session, url }
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed

  // กด Esc เพื่อปิดกล่องยืนยัน
  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e) {
      if (e.key === 'Escape' && !closing) setConfirmOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, closing]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setExisting(null);

    const table = Number(tableNumber);
    const adults = Number(adultCount);
    const children = Number(childCount);

    if (!Number.isInteger(table) || table < 1) {
      setError('กรุณากรอกเลขโต๊ะเป็นตัวเลข (1 ขึ้นไป)');
      return;
    }
    if (
      !Number.isInteger(adults) || adults < 0 ||
      !Number.isInteger(children) || children < 0
    ) {
      setError('จำนวนผู้ใหญ่และเด็กต้องเป็นตัวเลข 0 ขึ้นไป');
      return;
    }

    setSubmitting(true);

    // 1) เช็คว่าโต๊ะนี้มี session เปิดค้างอยู่ไหม
    const { data: openRows, error: checkError } = await supabase
      .from('sessions')
      .select('id, table_number, adult_count, child_count, created_at')
      .eq('table_number', table)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      setError(`ตรวจสอบโต๊ะไม่สำเร็จ: ${checkError.message}`);
      setSubmitting(false);
      return;
    }
    if (openRows.length > 0) {
      setExisting(openRows[0]);
      setSubmitting(false);
      return;
    }

    // 2) ไม่มี → สร้าง session ใหม่
    const { data, error: insertError } = await supabase
      .from('sessions')
      .insert({
        table_number: table,
        adult_count: adults,
        child_count: children,
        status: 'open',
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      // 23505 = ชน unique index (มีคนอื่นเปิดโต๊ะนี้ไปพอดี)
      setError(
        insertError.code === '23505'
          ? 'โต๊ะนี้เพิ่งถูกเปิดโดยคนอื่น กรุณากด "เปิดโต๊ะ" อีกครั้ง'
          : `เปิดโต๊ะไม่สำเร็จ: ${insertError.message}`
      );
      return;
    }

    setResult({ session: data, url: `${window.location.origin}/order/${table}` });
  }

  function openConfirm() {
    const ms = Date.now() - new Date(existing.created_at).getTime();
    setMinutesOpen(Math.max(0, Math.floor(ms / 60000)));
    setCloseError('');
    setConfirmOpen(true);
  }

  async function confirmClose() {
    setClosing(true);
    setCloseError('');

    // เช็ค status = 'open' ซ้ำตอน update กันการกดซ้ำซ้อน
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'closed' })
      .eq('id', existing.id)
      .eq('status', 'open');

    setClosing(false);

    if (error) {
      setCloseError(`ปิดโต๊ะไม่สำเร็จ: ${error.message}`);
      return;
    }
    setConfirmOpen(false);
    setExisting(null); // กลับไปที่ฟอร์ม ค่าที่กรอกยังอยู่ครบ
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2500);
  }

  function resetAll() {
    setResult(null);
    setExisting(null);
    setError('');
    setCopyState('idle');
    setTableNumber('');
    setAdultCount('1');
    setChildCount('0');
  }

  // ---------- หน้าผลลัพธ์ QR ----------
  if (result) {
    const { session, url } = result;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    return (
      <main className="page staff">
        <h1>เปิดโต๊ะสำเร็จ</h1>
        <section className="card stack qr-result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="qr-img"
            src={qrSrc}
            width={300}
            height={300}
            alt={`QR Code โต๊ะ ${session.table_number}`}
          />
          <p className="summary">
            โต๊ะ {session.table_number} · ผู้ใหญ่ {session.adult_count} · เด็ก {session.child_count}
          </p>
          <div className="copy-row">
            <span className="link-text">{url}</span>
            <button type="button" className="btn small ghost" onClick={copyLink}>
              {copyState === 'copied' ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>
          {copyState === 'failed' && (
            <p className="error">คัดลอกไม่ได้ ลองกดค้างที่ลิงก์แล้วเลือกคัดลอกเอง</p>
          )}
          <button type="button" className="btn" onClick={resetAll}>
            เปิดโต๊ะใหม่
          </button>
        </section>
      </main>
    );
  }

  // ---------- หน้าฟอร์ม ----------
  return (
    <main className="page staff">
      <Link href="/" className="back">← หน้าแรก</Link>
      <h1>เปิดโต๊ะ</h1>

      <form className="card stack" onSubmit={handleSubmit}>
        <label className="field">
          เลขโต๊ะ
          <input
            type="number"
            inputMode="numeric"
            min="1"
            required
            value={tableNumber}
            onChange={(e) => {
              setTableNumber(e.target.value);
              setExisting(null); // เปลี่ยนโต๊ะแล้ว คำเตือนเดิมใช้ไม่ได้
            }}
            placeholder="เช่น 7"
          />
        </label>
        <div className="row">
          <label className="field">
            ผู้ใหญ่ (คน)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              required
              value={adultCount}
              onChange={(e) => setAdultCount(e.target.value)}
            />
          </label>
          <label className="field">
            เด็ก (คน)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              required
              value={childCount}
              onChange={(e) => setChildCount(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn" disabled={submitting}>
          {submitting ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
        </button>
      </form>

      {existing && (
        <section className="alert" role="alert">
          <p className="alert-title">
            โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button type="button" className="btn danger" onClick={openConfirm}>
            ปิดออเดอร์เดิม
          </button>
        </section>
      )}

      {existing && confirmOpen && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">ปิดโต๊ะเดิม?</h2>
            <ul className="modal-info">
              <li>โต๊ะ {existing.table_number}</li>
              <li>ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}</li>
              <li>เปิดมาแล้ว {minutesOpen} นาที</li>
            </ul>
            {closeError && <p className="error" role="alert">{closeError}</p>}
            <div className="row">
              <button
                type="button"
                className="btn ghost"
                autoFocus
                disabled={closing}
                onClick={() => setConfirmOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={closing}
                onClick={confirmClose}
              >
                {closing ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
