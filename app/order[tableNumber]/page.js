'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function OrderPage({ params }) {
  // Unwrap params ตามกฎ Next.js เวอร์ชันล่าสุด
  const resolvedParams = use(params);
  const tableNumber = resolvedParams.tableNumber;

  // State ควบคุม Session และสถานะโต๊ะ
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // State ข้อมูลเมนูและหมวดหมู่
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  // State ตะกร้าสินค้าและการส่งออเดอร์
  const [cart, setCart] = useState({}); // { itemId: { id, name, quantity } }
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState(false);

  // State สำหรับโมดัลเช็คบิล
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // 1. ตรวจสอบ Session ของโต๊ะเมื่อโหลดหน้าเว็บ
  useEffect(() => {
    async function fetchSessionAndMenu() {
      try {
        setLoadingSession(true);
        // ค้นหา session ที่เปิดอยู่ของโต๊ะนี้
        const { data: sessionsData, error: sessionErr } = await supabase
          .from('sessions')
          .select('*')
          .eq('table_number', tableNumber)
          .eq('status', 'open')
          .single();

        if (sessionErr || !sessionsData) {
          setSessionError(true);
          setLoadingSession(false);
          return;
        }

        setSession(sessionsData);

        // ดึงข้อมูลหมวดหมู่เมนู (เรียงตาม sort_order)
        const { data: catData } = await supabase
          .from('menu_categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (catData && catData.length > 0) {
          setCategories(catData);
          setActiveCategory(catData[0].id);
        }

        // ดึงข้อมูลรายการเมนูทั้งหมด
        const { data: itemData } = await supabase
          .from('menu_items')
          .select('*');

        if (itemData) {
          setMenuItems(itemData);
        }
      } catch (err) {
        console.error('Error initializing order page:', err);
        setSessionError(true);
      } finally {
        setLoadingSession(false);
      }
    }

    if (tableNumber) {
      fetchSessionAndMenu();
    }
  }, [tableNumber]);

  // คำนวณจำนวนรายการทั้งหมดในตะกร้า
  const totalCartItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);

  // ฟังก์ชันเพิ่ม/ลดจำนวนสินค้าในตะกร้า (จำกัดไม่เกิน 5 ต่อรายการ / สูงสุดรวม 10 รายการ)
  const updateQuantity = (item, delta) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.quantity || 0;
      const newQty = currentQty + delta;

      // ตรวจสอบลิมิตรวมต่อการส่ง 1 ครั้ง (สูงสุด 10 รายการ)
      if (delta > 0 && totalCartItems >= 10) {
        alert('สามารถสั่งอาหารได้สูงสุด 10 รายการต่อการส่ง 1 ครั้ง กรุณาส่งออเดอร์ก่อน');
        return prev;
      }

      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      if (newQty > 5) {
        alert('สามารถสั่งเมนูนี้ได้สูงสุด 5 จานต่อครั้ง');
        return prev;
      }

      return {
        ...prev,
        [item.id]: { id: item.id, name: item.name, quantity: newQty },
      };
    });
  };

  // 2. ส่งออเดอร์ไปยัง Supabase
  const handleSendOrder = async () => {
    if (totalCartItems === 0) return;

    setSubmitting(true);
    try {
      const itemsArray = Object.values(cart).map((i) => ({
        name: i.name,
        quantity: i.quantity,
      }));

      const { error } = await supabase.from('orders').insert([
        {
          session_id: session.id,
          table_number: tableNumber,
          items: itemsArray,
          status: 'received',
        },
      ]);

      if (error) throw error;

      // เคลียร์ตะกร้าและแจ้งเตือนสำเร็จ
      setCart({});
      setOrderSuccessMessage(true);
      setTimeout(() => setOrderSuccessMessage(false), 3000);
    } catch (err) {
      console.error('Error sending order:', err);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. ฟังก์ชันเรียกเก็บเงิน (ปิด Session)
  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id);

      if (error) throw error;
      setIsClosed(true);
    } catch (err) {
      console.error('Error closing session:', err);
      alert('เกิดข้อผิดพลาดในการเรียกเก็บเงิน');
    } finally {
      setCheckingOut(false);
      setShowCheckoutModal(false);
    }
  };

  // คำนวณยอดเงินบุฟเฟต์ (ผู้ใหญ่ 289, เด็ก 145)
  const adultTotal = (session?.adult_count || 0) * 289;
  const childTotal = (session?.child_count || 0) * 145;
  const grandTotal = adultTotal + childTotal;

  // Render กรณีโหลดข้อมูล
  if (loadingSession) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ fontSize: '18px', color: '#666' }}>กำลังตรวจสอบข้อมูลโต๊ะ...</p>
      </div>
    );
  }

  // Render กรณีโต๊ะยังไม่เปิดใช้งาน
  if (sessionError) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.cardError}>
          <h2 style={{ color: '#d9534f', marginBottom: '10px' }}>โต๊ะนี้ยังไม่เปิดใช้งาน</h2>
          <p style={{ color: '#555' }}>กรุณาแจ้งพนักงานเพื่อเปิดโต๊ะก่อนทำรายการสั่งอาหาร</p>
        </div>
      </div>
    );
  }

  // Render กรณีปิดบิล/เรียกเก็บเงินแล้ว
  if (isClosed) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.cardSuccess}>
          <h1 style={{ color: '#28a745', fontSize: '28px', marginBottom: '10px' }}>ขอบคุณที่ใช้บริการ</h1>
          <p style={{ color: '#555', fontSize: '16px' }}>อิ่มอร่อยกับ "ร้านหลังมอ" แล้ว หวังว่าจะกลับมาใช้บริการอีกนะครับ/ค่ะ</p>
        </div>
      </div>
    );
  }

  // กรองเมนูตามหมวดหมู่ที่เลือก
  const filteredMenuItems = menuItems.filter((item) => item.category_id === activeCategory);

  return (
    <div style={styles.container}>
      {/* Header ร้านและปุ่มเรียกเก็บเงิน */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.shopName}>ร้านหลังมอ</h1>
          <span style={styles.tableBadge}>โต๊ะ {tableNumber}</span>
        </div>
        <button 
          onClick={() => setShowCheckoutModal(true)} 
          style={styles.checkoutBtn}
        >
          💳 เรียกเก็บเงิน
        </button>
      </header>

      {/* แจ้งเตือนเมื่อส่งออเดอร์สำเร็จ */}
      {orderSuccessMessage && (
        <div style={styles.successToast}>
          🎉 ส่งออเดอร์เรียบร้อยแล้ว! สามารถสั่งรอบใหม่ต่อได้เลย
        </div>
      )}

      {/* หมวดหมู่เมนู (Tabs) */}
      <div style={styles.tabContainer}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              ...styles.tabButton,
              ...(activeCategory === cat.id ? styles.tabButtonActive : {}),
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* รายการอาหารในหมวดหมู่ */}
      <div style={styles.menuList}>
        {filteredMenuItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>ไม่มีเมนูในหมวดหมู่นี้</p>
        ) : (
          filteredMenuItems.map((item) => {
            const qty = cart[item.id]?.quantity || 0;
            return (
              <div key={item.id} style={styles.menuCard}>
                <div style={styles.menuInfo}>
                  <h3 style={styles.menuTitle}>{item.name}</h3>
                </div>
                <div style={styles.counterContainer}>
                  {qty > 0 && (
                    <>
                      <button 
                        onClick={() => updateQuantity(item, -1)} 
                        style={styles.qtyBtn}
                      >
                        -
                      </button>
                      <span style={styles.qtyText}>{qty}</span>
                    </>
                  )}
                  <button 
                    onClick={() => updateQuantity(item, 1)} 
                    style={styles.addBtn}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ตะกร้าลอยด้านล่างจอ (Floating Cart) */}
      {totalCartItems > 0 && (
        <div style={styles.floatingCart}>
          <div style={styles.cartInfo}>
            <span style={styles.cartBadge}>{totalCartItems}</span>
            <span>รายการในตะกร้า (สูงสุด 10)</span>
          </div>
          <button 
            onClick={handleSendOrder} 
            disabled={submitting} 
            style={styles.sendOrderBtn}
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
          </button>
        </div>
      )}

      {/* โมดัลยืนยันเรียกเก็บเงิน */}
      {showCheckoutModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginBottom: '15px', color: '#333' }}>ยืนยันเรียกเก็บเงิน</h2>
            <div style={styles.billDetails}>
              <p>ผู้ใหญ่: {session.adult_count} ท่าน × 289 = {adultTotal} บาท</p>
              <p>เด็ก: {session.child_count} ท่าน × 145 = {childTotal} บาท</p>
              <hr style={{ margin: '10px 0', borderColor: '#eee' }} />
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#d9534f' }}>
                ยอดรวมทั้งสิ้น: {grandTotal} บาท
              </p>
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              เมื่อกดยืนยัน ระบบจะปิดโต๊ะทันทีและไม่สามารถสั่งอาหารเพิ่มได้
            </p>
            <div style={styles.modalActions}>
              <button 
                onClick={() => setShowCheckoutModal(false)} 
                style={styles.cancelModalBtn}
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleCheckout} 
                disabled={checkingOut} 
                style={styles.confirmModalBtn}
              >
                {checkingOut ? 'กำลังดำเนินการ...' : 'ยืนยันชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// สไตล์ดีไซน์มือถือ อ่านง่าย ใช้งานด้วยนิ้วโป้ง
const styles = {
  container: {
    padding: '16px',
    paddingBottom: '100px', // เผื่อพื้นที่ให้ตะกร้าลอยด้านล่าง
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
    maxWidth: '480px',
    margin: '0 auto',
  },
  centerScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
  },
  cardError: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  cardSuccess: {
    backgroundColor: '#fff',
    padding: '40px 20px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  },
  shopName: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  tableBadge: {
    fontSize: '12px',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    padding: '2px 8px',
    borderRadius: '6px',
    fontWeight: '600',
  },
  checkoutBtn: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    border: '1px solid #ffeeba',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  successToast: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '14px',
    textAlign: 'center',
    fontWeight: '500',
  },
  tabContainer: {
    display: 'flex',
    overflowX: 'auto',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  tabButton: {
    flexShrink: 0,
    padding: '8px 16px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#4a5568',
    cursor: 'pointer',
    fontWeight: '500',
  },
  tabButtonActive: {
    backgroundColor: '#3182ce',
    color: '#fff',
    borderColor: '#3182ce',
  },
  menuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  menuCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: '14px 16px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  menuInfo: {
    flex: 1,
    paddingRight: '10px',
  },
  menuTitle: {
    fontSize: '15px',
    margin: 0,
    color: '#2d3748',
    fontWeight: '600',
  },
  counterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  addBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#3182ce',
    color: '#fff',
    border: 'none',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#edf2f7',
    color: '#4a5568',
    border: 'none',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: '15px',
    fontWeight: 'bold',
    minWidth: '20px',
    textAlign: 'center',
  },
  floatingCart: {
    position: 'fixed',
    bottom: '16px',
    left: '16px',
    right: '16px',
    maxWidth: '448px',
    margin: '0 auto',
    backgroundColor: '#1a202c',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    zIndex: 100,
  },
  cartInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: '500',
  },
  cartBadge: {
    backgroundColor: '#3182ce',
    color: '#fff',
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  sendOrderBtn: {
    backgroundColor: '#48bb78',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '360px',
    textAlign: 'center',
  },
  billDetails: {
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '15px',
    fontSize: '14px',
    color: '#4a5568',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: '#edf2f7',
    color: '#4a5568',
    border: 'none',
    padding: '10px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  confirmModalBtn: {
    flex: 1,
    backgroundColor: '#e53e3e',
    color: '#fff',
    border: 'none',
    padding: '10px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};