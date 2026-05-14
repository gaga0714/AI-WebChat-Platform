import { ref } from 'vue'
import { API_HEADERS } from '@/config/deepseek'

export function useBalance() {
  const totalAmt = ref(0)

  async function fetchBalance() {
    try {
      const r = await fetch('/api/balance', { headers: API_HEADERS })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()

      if (data?.total_granted !== undefined) {
        const remaining = (data.total_granted || 0) - (data.total_used || 0)
        totalAmt.value = Number((remaining || 0).toFixed(4))
        return
      }
      if (Array.isArray(data?.balance_infos)) {
        let sum = 0
        for (const o of data.balance_infos) sum += Number(o.total_balance || 0)
        totalAmt.value = sum
        return
      }
      totalAmt.value = 0
    } catch {
      totalAmt.value = 0
    }
  }

  return { totalAmt, fetchBalance }
}
