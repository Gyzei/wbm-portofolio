<?php
function deleteProject(mysqli $conn, int $id): bool
{
    $conn->begin_transaction();
    try {
        $project = $conn->prepare('SELECT id FROM projects WHERE id=? FOR UPDATE');
        $project->bind_param('i', $id);
        $project->execute();
        if (!$project->get_result()->fetch_assoc()) {
            $conn->rollback();
            return false;
        }
        $highlights = $conn->prepare('DELETE FROM slides WHERE project_id=?');
        $highlights->bind_param('i', $id);
        $highlights->execute();
        if ($highlights->affected_rows > 0) {
            $remaining = $conn->query('SELECT id FROM slides ORDER BY slide_order ASC, id ASC FOR UPDATE');
            $update = $conn->prepare('UPDATE slides SET slide_order=? WHERE id=?');
            $position = 1;
            while ($slide = $remaining->fetch_assoc()) {
                $slideId = (int)$slide['id'];
                $update->bind_param('ii', $position, $slideId);
                $update->execute();
                $position++;
            }
        }
        $project = $conn->prepare('DELETE FROM projects WHERE id=?');
        $project->bind_param('i', $id);
        $project->execute();
        $conn->commit();
        return true;
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
}
