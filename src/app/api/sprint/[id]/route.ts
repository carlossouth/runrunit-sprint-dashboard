import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'Sprint ID is required' }, { status: 400 });
  }

  const APP_KEY = process.env.RUNRUNIT_APP_KEY;
  const USER_TOKEN = process.env.RUNRUNIT_USER_TOKEN;

  if (!APP_KEY || !USER_TOKEN) {
    return NextResponse.json({ error: 'Server misconfiguration: API credentials missing' }, { status: 500 });
  }

  try {
    // Fetch users mapping
    const usersRes = await fetch('https://runrun.it/api/v1.0/users?limit=200', {
      headers: {
        'App-Key': APP_KEY,
        'User-Token': USER_TOKEN
      }
    });
    const usersData = await usersRes.json();
    const userMap: Record<number, any> = {};
    if (Array.isArray(usersData)) {
      usersData.forEach((u: any) => {
        userMap[u.id] = {
          role: u.position || '',
          avatar: u.avatar_url || ''
        };
      });
    }

    // Fetch tasks (both active and closed)
    const [activeTasksRes, closedTasksRes] = await Promise.all([
      fetch('https://runrun.it/api/v1.0/tasks?limit=1000&is_closed=false', {
        headers: {
          'App-Key': APP_KEY,
          'User-Token': USER_TOKEN
        }
      }),
      fetch('https://runrun.it/api/v1.0/tasks?limit=1000&is_closed=true', {
        headers: {
          'App-Key': APP_KEY,
          'User-Token': USER_TOKEN
        }
      })
    ]);

    if (!activeTasksRes.ok) {
      throw new Error(`Failed to fetch active tasks: ${activeTasksRes.statusText}`);
    }
    if (!closedTasksRes.ok) {
      throw new Error(`Failed to fetch closed tasks: ${closedTasksRes.statusText}`);
    }

    const activeTasks = await activeTasksRes.json();
    const closedTasks = await closedTasksRes.json();

    const tasks = [
      ...(Array.isArray(activeTasks) ? activeTasks : []),
      ...(Array.isArray(closedTasks) ? closedTasks : [])
    ];
    
    // Filter tasks by IdSprint custom field (custom_142)
    const sprintTasks = tasks.filter((t: any) => {
      if (!t.custom_fields) return false;
      const sprintValue = t.custom_fields.custom_142;
      return sprintValue && sprintValue.toString().trim() === id;
    });

    // Map the raw data to a simplified representation for the frontend
    const payload = sprintTasks.map((task: any) => {
      // Map Estimates
      // custom_70: Back, custom_72: Front, custom_133: Tester
      const estBack = task.custom_fields.custom_70 || null;
      const estFront = task.custom_fields.custom_72 || null;
      const estQA = task.custom_fields.custom_133 || null;
      const estMobile = task.custom_fields.custom_127 || null;

      const assignments = (task.assignments || []).map((a: any) => ({
        assignee_id: a.assignee_id,
        assignee_name: a.assignee_name,
        time_worked: a.time_worked,
        time_worked_seconds: a.time_worked || 0,
        role: userMap[a.assignee_id]?.role || '',
        avatar: userMap[a.assignee_id]?.avatar || '',
        is_working_on: a.is_working_on || false
      }));

      return {
        id: task.id,
        title: task.title,
        status: task.board_stage_name,
        status_id: task.board_stage_id,
        is_working_on: task.is_working_on || false,
        estimates: {
          back: estBack,
          front: estFront,
          mobile: estMobile,
          qa: estQA
        },
        assignments
      };
    });

    return NextResponse.json({ success: true, count: payload.length, data: payload });
  } catch (error: any) {
    console.error('API Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
