"""
Anomaly detection rule engine - zero LLM dependency.
9 async scan rules for Python side analysis.
4 sync rules are in Java BookingServiceImpl (not here).
"""

from db.connection import get_db


def scan_double_booking():
    """Rule 1: Detect double-booked rooms (overlapping bookings)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id AS booking_a, b.id AS booking_b,
                   a.room_id, r.room_number,
                   a.check_in AS a_in, a.check_out AS a_out,
                   b.check_in AS b_in, b.check_out AS b_out
            FROM bookings a
            JOIN bookings b ON a.room_id = b.room_id AND a.id < b.id
            JOIN rooms r ON a.room_id = r.id
            WHERE a.status NOT IN ('CANCELLED', 'COMPLETED')
              AND b.status NOT IN ('CANCELLED', 'COMPLETED')
              AND a.check_in < b.check_out
              AND b.check_in < a.check_out
        """)
        return cursor.fetchall()


def scan_date_inversion():
    """Rule 2: Check-in date >= Check-out date."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.id, b.room_id, r.room_number,
                   b.check_in, b.check_out, b.status
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE b.check_in >= b.check_out
              AND b.status NOT IN ('CANCELLED')
        """)
        return cursor.fetchall()


def scan_room_status_conflict():
    """Rule 3: Maintenance rooms booked."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.id, b.room_id, r.room_number, r.status AS room_status,
                   b.check_in, b.check_out, b.status AS booking_status
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE r.status = 'MAINTENANCE'
              AND b.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
        """)
        return cursor.fetchall()


def scan_long_stay_no_checkout():
    """Rule 4: Checked-in guests with stay > 30 days."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.id, b.room_id, r.room_number, g.name AS guest_name,
                   b.check_in, b.check_out,
                   DATEDIFF(NOW(), b.check_in) AS days_stayed
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN guests g ON b.guest_id = g.id
            WHERE b.status = 'CHECKED_IN'
              AND DATEDIFF(NOW(), b.check_in) > 30
        """)
        return cursor.fetchall()


def scan_guest_no_history():
    """Rule 5: Guest with zero bookings (orphan data)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT g.id, g.name, COUNT(b.id) AS booking_count
            FROM guests g
            LEFT JOIN bookings b ON g.id = b.guest_id
            GROUP BY g.id, g.name
            HAVING COUNT(b.id) = 0
        """)
        return cursor.fetchall()


def scan_vacant_rooms_long():
    """Rule 6: Rooms vacant > 30 consecutive days."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.id, r.room_number, r.type, r.status
            FROM rooms r
            WHERE r.status = 'AVAILABLE'
              AND r.id NOT IN (
                  SELECT DISTINCT room_id FROM bookings
                  WHERE check_out >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    AND status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
              )
        """)
        return cursor.fetchall()


def scan_price_anomaly():
    """Rule 7: Rooms with price deviating >50% from same type avg."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.id, r.room_number, r.type, r.price,
                   AVG(r2.price) AS type_avg_price
            FROM rooms r
            JOIN rooms r2 ON r.type = r2.type AND r.id != r2.id
            GROUP BY r.id, r.room_number, r.type, r.price
            HAVING ABS(r.price - AVG(r2.price)) / NULLIF(AVG(r2.price), 0) > 0.5
        """)
        return cursor.fetchall()


def scan_cancelled_rate():
    """Rule 8: Guest with >3 cancellations."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT g.id, g.name, COUNT(*) AS cancelled_count
            FROM guests g
            JOIN bookings b ON g.id = b.guest_id
            WHERE b.status = 'CANCELLED'
            GROUP BY g.id, g.name
            HAVING COUNT(*) > 3
        """)
        return cursor.fetchall()


def scan_pending_expired():
    """Rule 9: PENDING bookings where check_in is in the past."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.id, b.room_id, r.room_number, g.name AS guest_name,
                   b.check_in, b.status
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN guests g ON b.guest_id = g.id
            WHERE b.status = 'PENDING'
              AND b.check_in < NOW()
        """)
        return cursor.fetchall()


# All scan rules registry: (key, display_name, function, severity)
ALL_RULES = [
    ("double_booking",     "双订冲突",         scan_double_booking,      "critical"),
    ("date_inversion",     "日期倒挂",         scan_date_inversion,      "critical"),
    ("room_status_conflict","房态冲突",         scan_room_status_conflict,"critical"),
    ("long_stay_no_checkout","超长入住未退房",  scan_long_stay_no_checkout,"warning"),
    ("guest_no_history",   "客人无预订记录",    scan_guest_no_history,    "info"),
    ("vacant_rooms_long",  "房间长期空置",      scan_vacant_rooms_long,   "warning"),
    ("price_anomaly",      "价格异常偏离",      scan_price_anomaly,       "warning"),
    ("cancelled_rate",     "异常取消率",        scan_cancelled_rate,      "warning"),
    ("pending_expired",    "过期待处理预订",    scan_pending_expired,     "warning"),
]
