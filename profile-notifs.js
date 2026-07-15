
window.unreadNotificationsUnsub = null;
window.openNotifications = function() {
  if (!window.currentUser) {
    showToast("<i data-lucide=lightbulb></i> Please login to view notifications.");
    openAuthModal("login");
    return;
  }
  const modal = document.getElementById("notificationsModal");
  if (modal) {
    modal.style.display = "flex";
    if (typeof loadNotifications === 'function') loadNotifications();
  }
};
window.closeNotificationsModal = function() {
  const modal = document.getElementById("notificationsModal");
  if (modal) modal.style.display = "none";
};
window.loadNotifications = function() {
  if (!window.currentUser || !window._firebase) return;
  const list = document.getElementById("notificationsList");
  if (!list) return;
  list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i data-lucide="loader-2" class="lucide-spin"></i> Loading...</div>';
  if(typeof lucide !== 'undefined') lucide.createIcons();
  window._firebase.db.collection('users').doc(window.currentUser.uid).collection('notifications').orderBy('createdAt', 'desc').limit(20).get().then(snap => {
      if (snap.empty) {
        list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">No notifications yet.</div>';
        return;
      }
      let html = '';
      snap.docs.forEach(doc => {
        const data = doc.data();
        const dateStr = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleString('en-IN') : 'Recently';
        const isUnread = data.read !== true;
        const bg = isUnread ? 'rgba(59, 130, 246, 0.05)' : 'transparent';
        const border = isUnread ? 'border-left: 3px solid #3b82f6;' : 'border-left: 3px solid transparent;';
        html += '<div class="notif-item" style="padding: 12px; border-bottom: 1px solid var(--border-light); background: ' + bg + '; ' + border + ' cursor: pointer; border-radius: 4px; margin-bottom: 4px; display: flex; flex-direction: column; gap: 4px;" onclick="markNotificationRead(\'' + doc.id + '\', ' + isUnread + ')">';
        html += '<div style="font-weight: 600; font-size: 0.9rem; color: var(--text);">' + (data.title || 'Notification') + '</div>';
        html += '<div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3;">' + (data.message || '') + '</div>';
        html += '<div style="font-size: 0.7rem; color: var(--text-muted); text-align: right;">' + dateStr + '</div>';
        html += '</div>';
      });
      list.innerHTML = html;
  }).catch(err => {
      console.error("Error loading notifications:", err);
      list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Failed to load notifications.</div>';
  });
};
window.markNotificationRead = function(id, isUnread) {
  if (!isUnread || !window.currentUser || !window._firebase) return;
  window._firebase.db.collection('users').doc(window.currentUser.uid).collection('notifications').doc(id).update({ read: true }).then(() => {
      loadNotifications();
  }).catch(err => console.error("Error marking read:", err));
};
window.clearAllNotifications = function() {
  if (!window.currentUser || !window._firebase) return;
  const list = document.getElementById("notificationsList");
  if (list) list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i data-lucide="loader-2" class="lucide-spin"></i> Clearing...</div>';
  if(typeof lucide !== 'undefined') lucide.createIcons();
  window._firebase.db.collection('users').doc(window.currentUser.uid).collection('notifications').where('read', '==', false).get().then(snap => {
      if (snap.empty) {
          if (list) list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">No notifications yet.</div>';
          return;
      }
      const batch = window._firebase.db.batch();
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      return batch.commit().then(() => loadNotifications());
  }).catch(err => {
      console.error("Error clearing notifications:", err);
      if (list) list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Error clearing.</div>';
  });
};
window.listenToUnreadNotifications = function(uid) {
  if (window.unreadNotificationsUnsub) window.unreadNotificationsUnsub();
  if (!window._firebase || !window._firebase.db) return;
  window.unreadNotificationsUnsub = window._firebase.db.collection('users').doc(uid).collection('notifications').where('read', '==', false).onSnapshot(snap => {
      const badge = document.getElementById("notifBadge");
      if (badge) {
        if (!snap.empty) {
          badge.style.display = "flex";
          badge.textContent = snap.size > 9 ? "9+" : snap.size;
        } else {
          badge.style.display = "none";
        }
      }
  }, err => {
      console.error("Error listening to notifications:", err);
  });
};

document.addEventListener("DOMContentLoaded", () => {
    // Override the dash tab function natively inside window so we dont monkey patch broken references
    const origSwitch = window.switchDashTab;
    if (origSwitch) {
        window.switchDashTab = function(e,t){
            ["dashQuotes","dashBookings","dashAddresses","dashInvoices","dashReviews","dashReferral","dashProfile","dashAdmin","dashPayments","dashSupport","dashSettings"].forEach(tab=>{
                const el=document.getElementById(tab);
                if(el)el.style.display="none";
            });
            document.querySelectorAll(".dash-tab").forEach(el=>el.classList.remove("active"));
            const target=document.getElementById("dash"+e.charAt(0).toUpperCase()+e.slice(1));
            if(target)target.style.display="block";
            if(t)t.classList.add("active");

            if("referral"===e && typeof window.loadReferralData === 'function') window.loadReferralData();
            if("bookings"===e && typeof window.loadUserBookings === 'function') window.loadUserBookings();
            if("profile"===e && typeof window.loadProfileData === 'function') window.loadProfileData();
            if("addresses"===e && typeof window.loadUserAddresses === 'function') window.loadUserAddresses();
            if("invoices"===e && typeof window.loadUserInvoices === 'function') window.loadUserInvoices();
            if("reviews"===e && typeof window.loadUserReviews === 'function') window.loadUserReviews();
        };
    }

    // Wrap updateNavForUser natively
    const origUpdate = window.updateNavForUser;
    if (origUpdate) {
        window.updateNavForUser = function(e) {
            origUpdate(e);
            if (e) {
                if(typeof window.listenToUnreadNotifications === 'function') window.listenToUnreadNotifications(e.uid);
            } else {
                if (typeof window.unreadNotificationsUnsub !== 'undefined' && window.unreadNotificationsUnsub) {
                    window.unreadNotificationsUnsub();
                    window.unreadNotificationsUnsub = null;
                }
                const badge = document.getElementById("notifBadge");
                if (badge) badge.style.display = "none";
            }
        };
    }

    // Wrap loadProfileData natively
    const origLoadProfile = window.loadProfileData;
    if (origLoadProfile) {
        window.loadProfileData = function() {
            origLoadProfile();
            if (!window.currentUser || !window._firebase) return;
            window._firebase.db.collection("users").doc(window.currentUser.uid).get().then(e => {
                if (!e.exists) return;
                const t = e.data();
                const creationEl = document.getElementById("profileCreationDate");
                if (creationEl) {
                    creationEl.textContent = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toLocaleDateString('en-IN') : "Recently";
                }
                window._firebase.db.collection("bookings").where("customerUid", "==", window.currentUser.uid).get().then(bSnap => {
                    let active = 0;
                    let past = 0;
                    bSnap.forEach(b => {
                        const bData = b.data();
                        if (bData.status === "completed" || bData.status === "cancelled") {
                            past++;
                        } else {
                            active++;
                        }
                    });
                    const activeEl = document.getElementById("profileActiveBookings");
                    const pastEl = document.getElementById("profilePastBookings");
                    if (activeEl) activeEl.textContent = active;
                    if (pastEl) pastEl.textContent = past;
                }).catch(err => console.error("Error fetching bookings stats", err));
            });
        };
    }
});
