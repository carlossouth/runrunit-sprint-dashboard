import { NextResponse } from 'next/server';

// 💾 Cache Global em Memória (Serverless e Edge Friendly)
interface CacheStore {
  userMap: Record<number, any> | null;
  usersFetchedAt: number;
  activeTasks: any[] | null;
  closedTasks: any[] | null;
  tasksFetchedAt: number;
}

const GLOBAL_CACHE: CacheStore = {
  userMap: null,
  usersFetchedAt: 0,
  activeTasks: null,
  closedTasks: null,
  tasksFetchedAt: 0
};

// Configurações de TTL (Time to Live)
const USER_CACHE_TTL = 1000 * 60 * 60; // 1 Hora
const TASK_CACHE_TTL = 1000 * 60 * 2;  // 2 Minutos

export async function GET() {
  const APP_KEY = process.env.RUNRUNIT_APP_KEY;
  const USER_TOKEN = process.env.RUNRUNIT_USER_TOKEN;

  if (!APP_KEY || !USER_TOKEN) {
    return NextResponse.json({ error: 'Server misconfiguration: API credentials missing' }, { status: 500 });
  }

  const now = Date.now();

  try {
    // ----------------------------------------------------
    // PASSO 1: Verificar e Atualizar Cache de Usuários (TTL: 1h)
    // ----------------------------------------------------
    let userMap = GLOBAL_CACHE.userMap;
    const shouldRefreshUsers = !userMap || (now - GLOBAL_CACHE.usersFetchedAt > USER_CACHE_TTL);

    // ----------------------------------------------------
    // PASSO 2: Verificar e Atualizar Cache de Tarefas (TTL: 2m)
    // ----------------------------------------------------
    const shouldRefreshTasks = 
      !GLOBAL_CACHE.activeTasks || 
      !GLOBAL_CACHE.closedTasks || 
      (now - GLOBAL_CACHE.tasksFetchedAt > TASK_CACHE_TTL);

    if (shouldRefreshUsers || shouldRefreshTasks) {
      const fetches: Promise<any>[] = [];

      // Chamada de Usuários
      if (shouldRefreshUsers) {
        fetches.push(
          fetch('https://runrun.it/api/v1.0/users?limit=200', {
            headers: { 'App-Key': APP_KEY, 'User-Token': USER_TOKEN }
          }).then(res => res.json())
        );
      } else {
        fetches.push(Promise.resolve(null));
      }

      // Chamadas de Tarefas (Ativas e Fechadas)
      if (shouldRefreshTasks) {
        fetches.push(
          fetch('https://runrun.it/api/v1.0/tasks?limit=1000&is_closed=false', {
            headers: { 'App-Key': APP_KEY, 'User-Token': USER_TOKEN }
          }).then(res => res.json()),
          fetch('https://runrun.it/api/v1.0/tasks?limit=1000&is_closed=true&sort=close_date&sort_dir=desc', {
            headers: { 'App-Key': APP_KEY, 'User-Token': USER_TOKEN }
          }).then(res => res.json())
        );
      } else {
        fetches.push(Promise.resolve(null), Promise.resolve(null));
      }

      // Executa tudo em paralelo
      const [usersData, activeTasksData, closedTasksData] = await Promise.all(fetches);

      // Processa Usuários
      if (usersData && Array.isArray(usersData)) {
        const newUserMap: Record<number, any> = {};
        usersData.forEach((u: any) => {
          newUserMap[u.id] = {
            role: u.position || '',
            avatar: u.avatar_url || ''
          };
        });
        GLOBAL_CACHE.userMap = newUserMap;
        GLOBAL_CACHE.usersFetchedAt = now;
        userMap = newUserMap;
      }

      // Processa Tarefas Ativas
      if (activeTasksData && Array.isArray(activeTasksData)) {
        GLOBAL_CACHE.activeTasks = activeTasksData;
        GLOBAL_CACHE.tasksFetchedAt = now;
      }

      // Processa Tarefas Fechadas
      if (closedTasksData && Array.isArray(closedTasksData)) {
        GLOBAL_CACHE.closedTasks = closedTasksData;
        GLOBAL_CACHE.tasksFetchedAt = now;
      }
    }

    const resolvedUserMap = userMap || {};
    const rawActive = GLOBAL_CACHE.activeTasks || [];
    const rawClosed = GLOBAL_CACHE.closedTasks || [];

    // Helper de mapeamento de tarefas para formato uniforme no frontend
    const mapTask = (task: any) => {
      const assignments = (task.assignments || []).map((a: any) => ({
        assignee_id: a.assignee_id,
        assignee_name: a.assignee_name,
        time_worked: a.time_worked,
        time_worked_seconds: a.time_worked || 0,
        role: resolvedUserMap[a.assignee_id]?.role || '',
        avatar: resolvedUserMap[a.assignee_id]?.avatar || '',
        is_working_on: a.is_working_on || false
      }));

      return {
        id: task.id,
        title: task.title,
        status: task.board_stage_name,
        status_id: task.board_stage_id,
        is_working_on: task.is_working_on || false,
        type: task.type_name || 'Sem tipo',
        client_name: task.client_name || 'Sem Cliente',
        project_name: task.project_name || 'Sem Projeto',
        responsible_name: task.responsible_name || 'Não atribuído',
        desired_date: task.desired_date || null,
        created_at: task.created_at || null,
        close_date: task.close_date || null,
        time_worked: task.time_worked || 0,
        is_urgent: task.is_urgent || false,
        tags: task.tags || [],
        estimates: {
          back: task.custom_fields?.custom_70 || null,
          front: task.custom_fields?.custom_72 || null,
          mobile: task.custom_fields?.custom_127 || null,
          qa: task.custom_fields?.custom_133 || null
        },
        assignments
      };
    };

    const activeTasksMapped = rawActive.map(mapTask);
    const closedTasksMapped = rawClosed.map(mapTask);

    return NextResponse.json({
      success: true,
      cached: !shouldRefreshTasks,
      activeCount: activeTasksMapped.length,
      closedCount: closedTasksMapped.length,
      data: {
        active: activeTasksMapped,
        closed: closedTasksMapped
      }
    });

  } catch (error: any) {
    console.error('API Tasks Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
